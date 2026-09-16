'use strict';

const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const reviewPath = path.join(root, 'evidence', 'tmp', 'r2-review.json');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function freePort() { return new Promise((resolve) => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const p = server.address().port; server.close(() => resolve(p)); }); }); }
async function waitHealth(url, child) { for (let i = 0; i < 50; i += 1) { if (child.exitCode !== null) throw new Error('server exited'); try { if ((await fetch(`${url}/api/health`)).ok) return; } catch (_) {} await sleep(100); } throw new Error('server timeout'); }

(async () => {
  fs.mkdirSync(path.dirname(reviewPath), { recursive: true }); fs.writeFileSync(reviewPath, JSON.stringify({ schema_version: 'catalog-review.v1', reviews: [], history: [] }));
  const port = await freePort(); const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.join(root, 'apps/web/server.js'), String(port)], { cwd: root, env: { ...process.env, CNB_CATALOG_REVIEW_PATH: reviewPath }, windowsHide: true, stdio: 'ignore' });
  const browser = await chromium.launch({ headless: true });
  try {
    await waitHealth(base, child);
    const catalog = await (await fetch(`${base}/api/catalog`)).json();
    const benchmark = JSON.parse(fs.readFileSync(path.join(root, 'benchmarks/r2-real-cabinet/benchmark.json'), 'utf8'));
    const candidates = catalog.records.filter((record) => benchmark.selected_asset_ids.slice(0, 3).includes(record.source_asset_id) && !record.drawing_sheet && record.source_bbox?.width > 0 && record.source_bbox?.height > 0);
    for (const record of candidates) {
      const scale = Math.min(1, 180 / Math.max(record.source_bbox.width, record.source_bbox.height));
      const response = await fetch(`${base}/api/catalog/reviews`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source_asset_id: record.source_asset_id, representation_id: record.representation_id, confirmed_view: 'front', physical_width_mm: Math.max(8, +(record.source_bbox.width * scale).toFixed(3)), physical_height_mm: Math.max(8, +(record.source_bbox.height * scale).toFixed(3)) }) });
      if (!response.ok) throw new Error(`approval failed ${response.status}`);
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); await page.goto(base, { waitUntil: 'networkidle' });
    await page.selectOption('#scenarioSelect', 'r2'); await page.locator('#loadScenario').click(); await page.waitForTimeout(300); await page.screenshot({ path: path.join(root, 'evidence/screenshots', '08-r2-cad-panel.png'), fullPage: true });
    await page.locator('#assetTab').click(); await page.waitForSelector('.asset-card'); await page.screenshot({ path: path.join(root, 'evidence/screenshots', '09-r2-library.png'), fullPage: true });
    await page.locator('#componentTab').click(); const viewport = await page.locator('#canvasViewport').boundingBox(); await page.mouse.move(viewport.x + viewport.width * .55, viewport.y + viewport.height * .42); await page.mouse.wheel(0, -1800); await page.screenshot({ path: path.join(root, 'evidence/screenshots', '10-r2-deep-zoom.png'), fullPage: true });
    await page.mouse.down({ button: 'right' }); await page.mouse.move(viewport.x + viewport.width * .55 + 80, viewport.y + viewport.height * .42 + 50); await page.mouse.up({ button: 'right' }); await page.screenshot({ path: path.join(root, 'evidence/screenshots', '11-r2-pan.png'), fullPage: true });
    const state = await page.evaluate(async () => { const raw = await (await fetch('/api/benchmark/r2')).json(); const direct = window.CnbEirAdapter.adapt(raw); const normalized = window.CnbCadExport.normalizeModel(direct); return { components: window.CNB_APP.state.model.components.length, componentAssetIds: window.CNB_APP.state.model.components.slice(0, 3).map((component) => component.assetId || null), directAssetId: direct.components[0]?.assetId || null, normalizedAssetId: normalized.components[0]?.assetId || null, directPart: direct.components[0]?.partNumber || null, componentPartNumbers: window.CNB_APP.state.model.components.slice(0, 3).map((component) => component.partNumber), catalogStates: window.CNB_APP.state.assetCatalog.filter((asset) => asset.review_state === 'approved-footprint').map((asset) => asset.source_asset_id), approvedVectors: window.CNB_APP.state.model.components.filter((component) => component.assetId && window.CNB_APP.state.assetCatalog.find((asset) => (asset.source_asset_id || asset.id) === component.assetId)?.review_state === 'approved-footprint').length, zoom: window.CNB_APP.state.zoom, panX: window.CNB_APP.state.panX, panY: window.CNB_APP.state.panY }; });
    const report = { ok: true, approvedForEvidence: candidates.map((record) => record.source_asset_id), ...state }; fs.writeFileSync(path.join(root, 'evidence/test-logs/r2-browser-evidence.json'), `${JSON.stringify(report, null, 2)}\n`); console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); child.kill(); }
})().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
