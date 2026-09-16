'use strict';

const assert = require('node:assert/strict');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');

function reservePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}

async function waitForHealth(baseUrl, child, output) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`server exited: ${output.join('')}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch (_) {
      // Server is still binding its loopback socket.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`server health timeout: ${output.join('')}`);
}

(async () => {
  const port = await reservePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const output = [];
  const server = spawn(process.execPath, [path.join(root, 'apps', 'web', 'server.js'), String(port)], {
    cwd: root,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (chunk) => output.push(chunk.toString()));
  server.stderr.on('data', (chunk) => output.push(chunk.toString()));
  const browser = await chromium.launch({ headless: true });
  try {
    await waitForHealth(baseUrl, server, output);
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.locator('#autoLayout').click();
    const clean = await page.evaluate(() => ({ components: window.CNB_APP.state.model.components.length, issues: window.CNB_APP.state.issues.length }));
    assert.equal(clean.components, 35);
    assert.equal(clean.issues, 0);

    // Exercise the real HTML5 drag/drop route near a DIN rail and assert the
    // new device acquires the rail id and a 5 mm grid-aligned coordinate.
    const dropResult = await page.evaluate(() => {
      const source = document.querySelector('[data-kind="terminal"]');
      const target = document.querySelector('#panelSvg');
      const data = new DataTransfer();
      data.setData('text/cnb-component', 'terminal');
      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: data }));
      const box = target.getBoundingClientRect();
      const x = box.left + box.width * 0.52;
      const y = box.top + box.height * 0.22;
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, clientX: x, clientY: y, dataTransfer: data }));
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, clientX: x, clientY: y, dataTransfer: data }));
      const component = window.CNB_APP.state.model.components.at(-1);
      return { railId: component.railId, x: component.x, y: component.y, issues: window.CNB_APP.state.issues.length };
    });
    assert.ok(dropResult.railId, JSON.stringify(dropResult));
    assert.equal(dropResult.x % 5, 0);
    assert.equal(dropResult.y % 5, 0);

    // Zoom creates scrollable transformed content; middle-button pan must move
    // the viewport without selecting or mutating a component.
    await page.locator('#zoomIn').click();
    await page.locator('#zoomIn').click();
    const viewport = page.locator('#canvasViewport');
    const beforePan = await page.evaluate(() => ({ x: window.CNB_APP.state.panX, y: window.CNB_APP.state.panY }));
    const box = await viewport.boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(box.x + box.width * 0.5 + 80, box.y + box.height * 0.5 + 40);
    await page.mouse.up({ button: 'middle' });
    const afterPan = await page.evaluate(() => ({ x: window.CNB_APP.state.panX, y: window.CNB_APP.state.panY }));
    assert.ok(afterPan.x !== beforePan.x || afterPan.y !== beforePan.y, JSON.stringify({ beforePan, afterPan }));

    const report = { ok: true, clean, snappedDrop: dropResult, beforePan, afterPan, viewportPanChanged: true };
    require('node:fs').writeFileSync(path.join(root, 'evidence', 'test-logs', 'web-ui-behaviors.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
    server.kill();
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
