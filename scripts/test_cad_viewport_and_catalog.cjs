'use strict';

const assert = require('node:assert/strict');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
function port() { return new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); }); }
async function ready(url, child) { for (let i = 0; i < 50; i += 1) { if (child.exitCode !== null) throw new Error('server exited'); try { if ((await fetch(`${url}/api/health`)).ok) return; } catch (_) {} await new Promise((r) => setTimeout(r, 100)); } throw new Error('server timeout'); }

(async () => {
  const p = await port(); const base = `http://127.0.0.1:${p}`; const child = spawn(process.execPath, [path.join(root, 'apps/web/server.js'), String(p)], { cwd: root, windowsHide: true, stdio: 'ignore' }); const browser = await chromium.launch({ headless: true });
  try {
    await ready(base, child); const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.CNB_APP.state.assetCatalog.length === 58);
    await page.locator('#autoLayout').click();
    const viewport = page.locator('#canvasViewport'); const vb = await viewport.boundingBox(); const cursor = { x: vb.x + vb.width * .63, y: vb.y + vb.height * .38 };
    const before = await page.evaluate(({ x, y }) => window.CNB_APP.pointerToModel({ clientX: x, clientY: y }), cursor);
    await page.mouse.move(cursor.x, cursor.y); await page.mouse.wheel(0, -700);
    const after = await page.evaluate(({ x, y }) => window.CNB_APP.pointerToModel({ clientX: x, clientY: y }), cursor);
    assert.ok(Math.abs(before.x - after.x) < 2 && Math.abs(before.y - after.y) < 2, JSON.stringify({ before, after }));
    const zoomed = await page.evaluate(() => window.CNB_APP.state.zoom); assert.ok(zoomed > 1 && zoomed <= 20);

    const beforeRightPan = await page.evaluate(() => ({ x: window.CNB_APP.state.panX, y: window.CNB_APP.state.panY })); await page.mouse.move(cursor.x, cursor.y); await page.mouse.down({ button: 'right' }); await page.mouse.move(cursor.x + 55, cursor.y + 25); await page.mouse.up({ button: 'right' }); const afterRightPan = await page.evaluate(() => ({ x: window.CNB_APP.state.panX, y: window.CNB_APP.state.panY })); assert.ok(afterRightPan.x !== beforeRightPan.x || afterRightPan.y !== beforeRightPan.y);

    const component = page.locator('[data-component-id="device-001"]'); await component.dispatchEvent('dblclick'); assert.ok(await page.evaluate(() => window.CNB_APP.state.zoom >= 3.5), JSON.stringify(await page.evaluate(() => ({ zoom: window.CNB_APP.state.zoom, selected: window.CNB_APP.state.selectedId })))); await page.keyboard.press('F'); assert.ok(await page.evaluate(() => window.CNB_APP.state.zoom > 0.1 && window.CNB_APP.state.zoom <= 1)); assert.ok(Math.abs(await page.evaluate(() => window.CNB_APP.state.panX)) < 0.1); assert.ok(Math.abs(await page.evaluate(() => window.CNB_APP.state.panY)) < 0.1);

    await page.locator('#assetTab').click(); await assert.doesNotReject(() => page.waitForSelector('.asset-card')); assert.equal(await page.locator('.asset-card').count(), 58); await page.screenshot({ path: path.join(root, 'evidence', 'screenshots', '06-cad-asset-library.png'), fullPage: true });
    const beforeCount = await page.evaluate(() => window.CNB_APP.state.model.components.length); await page.locator('.asset-card').first().click(); await page.locator('#addPreviewAsset').click(); assert.equal(await page.evaluate(() => window.CNB_APP.state.model.components.length), beforeCount + 1); assert.ok(await page.evaluate(() => Boolean(window.CNB_APP.state.model.components.at(-1).assetId)));
    await page.locator('#componentTab').click(); await page.locator('#fitCanvas').click(); await page.screenshot({ path: path.join(root, 'evidence', 'screenshots', '07-siemens-cad-panel.png'), fullPage: true });
    const report = { ok: true, catalogAssets: 58, cursorZoomStationary: true, zoom: zoomed, rightPan: { before: beforeRightPan, after: afterRightPan }, doubleClickZoom: true, fitShortcut: true, assetAdded: true }; fs.writeFileSync(path.join(root, 'evidence', 'test-logs', 'cad-viewport-catalog.json'), `${JSON.stringify(report, null, 2)}\n`); console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); child.kill(); }
})().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
