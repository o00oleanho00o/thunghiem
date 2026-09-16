'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');

function reservePort() { return new Promise((resolve, reject) => { const s = net.createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); }); }
async function wait(base) { for (let i = 0; i < 50; i += 1) { try { if ((await fetch(`${base}/api/health`)).ok) return; } catch (_) {} await new Promise((r) => setTimeout(r, 100)); } throw new Error('server did not start'); }

(async () => {
  const port = await reservePort(); const base = `http://127.0.0.1:${port}`; const child = spawn(process.execPath, [path.join(__dirname, '..', 'apps', 'web', 'server.js'), String(port)], { cwd: path.join(__dirname, '..'), windowsHide: true, stdio: 'ignore' });
  try {
    await wait(base);
    const products = await (await fetch(`${base}/api/r3/products`)).json(); assert.equal(products.products.length, 8);
    const eir = await (await fetch(`${base}/api/benchmark/r3`)).json(); assert.equal(eir.metadata.authoritative, true);
    const valid = await fetch(`${base}/api/export`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: eir, format: 'audit' }) }); assert.equal(valid.status, 200);
    const invalid = JSON.parse(JSON.stringify(eir)); invalid.placements[0].x = 0;
    const blocked = await fetch(`${base}/api/export`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: invalid, format: 'dxf' }) }); assert.equal(blocked.status, 422); const blockedBody = await blocked.json(); assert.ok(blockedBody.validation.errors.some((issue) => issue.code === 'E001'));
    const deviceId = eir.placements[0].device_id; const saved = await fetch(`${base}/api/eir/revisions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eir, command: { type: 'lock', device_id: deviceId, locked: true } }) }); assert.equal(saved.status, 200); const revision = await saved.json(); assert.equal(revision.eir.placements.find((item) => item.device_id === deviceId).locked, true);
    const report = { ok: true, productCount: products.products.length, validExportStatus: valid.status, invalidExportStatus: blocked.status, blockedCodes: blockedBody.validation.errors.map((issue) => issue.code), roundTripRevision: revision.revision, lockedDevice: deviceId };
    fs.mkdirSync(path.join(__dirname, '..', 'evidence', 'test-logs'), { recursive: true }); fs.writeFileSync(path.join(__dirname, '..', 'evidence', 'test-logs', 'r3-api.json'), `${JSON.stringify(report, null, 2)}\n`); console.log(JSON.stringify(report, null, 2));
  } finally { child.kill(); }
})().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
