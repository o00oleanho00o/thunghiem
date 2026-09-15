'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { auditDxf } = require('../packages/cad-export');

const root = path.resolve(__dirname, '..');

function reservePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const address = socket.address();
      socket.close(() => resolve(address.port));
    });
  });
}

async function waitForHealth(baseUrl, child, diagnostics) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`web server exited early (${child.exitCode}): ${diagnostics.join('')}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok && (await response.json()).ok) return;
    } catch (_) {
      // The child may still be binding its loopback socket.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`web server did not become healthy: ${diagnostics.join('')}`);
}

async function post(baseUrl, payload) {
  return fetch(`${baseUrl}/api/export`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

(async () => {
  const port = await reservePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const diagnostics = [];
  const child = spawn(process.execPath, [path.join(root, 'apps', 'web', 'server.js'), String(port)], {
    cwd: root,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => diagnostics.push(chunk.toString()));
  child.stderr.on('data', (chunk) => diagnostics.push(chunk.toString()));

  try {
    await waitForHealth(baseUrl, child, diagnostics);
    const fixture = JSON.parse(fs.readFileSync(path.join(root, 'examples', 'mcc-6-motor', 'project.json'), 'utf8'));

    const firstResponse = await post(baseUrl, { model: fixture, format: 'dxf' });
    assert.equal(firstResponse.status, 200);
    const first = Buffer.from(await firstResponse.arrayBuffer());
    const secondResponse = await post(baseUrl, { model: fixture, format: 'dxf' });
    assert.equal(secondResponse.status, 200);
    const second = Buffer.from(await secondResponse.arrayBuffer());
    assert.ok(first.equals(second), 'API DXF output must be deterministic');

    const dxf = first.toString('utf8');
    assert.match(dxf, /^0\r?\nSECTION/);
    assert.match(dxf, /\r?\nEOF\r?\n$/);
    const localAudit = auditDxf(dxf);
    assert.equal(localAudit.valid, true, JSON.stringify(localAudit));
    assert.deepEqual(localAudit.bounds, { minX: 0, minY: 0, maxX: 800, maxY: 2000 });

    const auditResponse = await post(baseUrl, { model: fixture, format: 'audit' });
    assert.equal(auditResponse.status, 200);
    const remoteAudit = await auditResponse.json();
    assert.equal(remoteAudit.valid, true, JSON.stringify(remoteAudit));
    assert.equal(remoteAudit.entityCount, localAudit.entityCount);

    const svgResponse = await post(baseUrl, { model: fixture, format: 'svg' });
    assert.equal(svgResponse.status, 200);
    assert.match(await svgResponse.text(), /^<svg\b/);

    const unsupported = await post(baseUrl, { model: fixture, format: 'dwg' });
    assert.equal(unsupported.status, 400);

    const dxfPath = path.join(root, 'evidence', 'generated-dxf', 'api-mcc-6-motor.dxf');
    const logPath = path.join(root, 'evidence', 'test-logs', 'web-api-test.json');
    fs.mkdirSync(path.dirname(dxfPath), { recursive: true });
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(dxfPath, first);
    const report = {
      ok: true,
      rawPythonEir: true,
      deterministic: true,
      dxfBytes: first.length,
      entityCount: localAudit.entityCount,
      counts: localAudit.counts,
      bounds: localAudit.bounds,
      unsupportedFormatStatus: unsupported.status,
    };
    fs.writeFileSync(logPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    child.kill();
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
