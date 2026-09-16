'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');
const { spawn, spawnSync } = require('node:child_process');
const { normalizeModel, exportDxf } = require('../packages/cad-export');

const root = path.resolve(__dirname, '..');
const reservePort = () => new Promise((resolve) => { const socket = net.createServer(); socket.listen(0, '127.0.0.1', () => { const port = socket.address().port; socket.close(() => resolve(port)); }); });
async function ready(base, child) { for (let i = 0; i < 80; i += 1) { if (child.exitCode !== null) throw new Error(`server exited (${child.exitCode})`); try { if ((await fetch(`${base}/api/health`)).ok) return; } catch (_) {} await new Promise((resolve) => setTimeout(resolve, 100)); } throw new Error('server timeout'); }
const snap = (value, step = 5) => Math.round(value / step) * step;

function componentBoundsFromDxf(text) {
  const lines = String(text).split(/\r?\n/); const entities = []; let inEntities = false; let current = null;
  const flush = () => { if (current && current.type === 'LINE' && current.layer === 'COMPONENT') entities.push(current); current = null; };
  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = lines[i].trim(); const value = lines[i + 1];
    if (code === '2' && value === 'ENTITIES') { inEntities = true; continue; }
    if (inEntities && code === '0' && value === 'ENDSEC') { flush(); inEntities = false; continue; }
    if (!inEntities) continue;
    if (code === '0') { flush(); current = { type: value, layer: '0' }; continue; }
    if (!current) continue;
    if (code === '8') current.layer = value;
    else if (code === '10') current.x = Number(value);
    else if (code === '20') current.y = Number(value);
    else if (code === '11') current.x2 = Number(value);
    else if (code === '21') current.y2 = Number(value);
  }
  flush();
  const points = entities.flatMap((item) => [{ x: item.x, y: item.y }, { x: item.x2, y: item.y2 }]);
  return { entities, minX: Math.min(...points.map((p) => p.x)), minY: Math.min(...points.map((p) => p.y)), maxX: Math.max(...points.map((p) => p.x)), maxY: Math.max(...points.map((p) => p.y)) };
}

(async () => {
  const port = await reservePort(); const base = `http://127.0.0.1:${port}`;
  const productionReviewPath = path.join(root, 'catalog', 'review', 'catalog-review.json');
  const productionReviewHash = fs.existsSync(productionReviewPath) ? crypto.createHash('sha256').update(fs.readFileSync(productionReviewPath)).digest('hex') : null;
  const tempReviewDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cnb-cad-review-')); const tempReviewPath = path.join(tempReviewDir, 'catalog-review.json');
  const child = spawn(process.execPath, [path.join(root, 'apps/web/server.js'), String(port)], { cwd: root, windowsHide: true, stdio: 'ignore', env: { ...process.env, CNB_CATALOG_REVIEW_PATH: tempReviewPath } });
  const browser = await chromium.launch({ headless: true });
  const evidence = {};
  try {
    await ready(base, child);
    const catalog = await (await fetch(`${base}/api/catalog`)).json();
    assert.equal(catalog.asset_count, 58);
    const idsByContent = new Map();
    catalog.records.forEach((record) => { const list = idsByContent.get(record.content_sha256) || []; list.push(record.source_asset_id); idsByContent.set(record.content_sha256, list); });
    const duplicate = [...idsByContent.values()].find((ids) => ids.length > 1);
    evidence.source_asset_identity_unique_by_provenance = catalog.records.length === new Set(catalog.records.map((record) => record.source_asset_id)).size;
    evidence.exact_duplicate_content_hash_preserved = Boolean(duplicate && duplicate.length > new Set(duplicate).size === false);
    assert.equal(evidence.source_asset_identity_unique_by_provenance, true);
    assert.ok(duplicate && new Set(duplicate).size === duplicate.length);
    const et = catalog.records.filter((record) => /et200sp-1515sp-pc-cpu/.test(record.candidate_product_key || ''));
    evidence.front_side_candidate_grouping_correct = new Set(et.map((record) => record.product_candidate_id)).size === 1 && new Set(et.map((record) => record.candidate_view)).size === 2;
    assert.equal(evidence.front_side_candidate_grouping_correct, true);

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.CNB_APP.state.assetCatalog.length === 58);
    await page.evaluate(() => { const model = window.CNB_APP.scenarios.starter(); window.CNB_APP.loadModel(model, 'hardening'); window.CNB_APP.fitCanvas(); });
    const zoomRoundtrips = [];
    for (const zoom of [0.5, 1, 5, 20]) {
      const result = await page.evaluate((z) => {
        window.CNB_APP.state.zoom = z; window.CNB_APP.state.panX = 37; window.CNB_APP.state.panY = -23; window.CNB_APP.render();
        const svg = document.querySelector('#panelSvg'); const c = window.CNB_APP.state.model.components[0]; const modelPoint = { x: c.x + 11, y: c.y + 17 }; const local = { x: modelPoint.x, y: window.CNB_APP.state.model.enclosure.height - modelPoint.y }; const screen = new DOMPoint(local.x, local.y).matrixTransform(svg.getScreenCTM()); const inverse = svg.getScreenCTM().inverse(); const roundtrip = new DOMPoint(screen.x, screen.y).matrixTransform(inverse); return { dx: roundtrip.x - local.x, dy: roundtrip.y - local.y };
      }, zoom); zoomRoundtrips.push(result); assert.ok(Math.abs(result.dx) < 0.01 && Math.abs(result.dy) < 0.01, JSON.stringify(result));
    }
    evidence.screen_model_roundtrip_correct = true;

    const drag = await page.evaluate(() => {
      window.CNB_APP.state.zoom = 5; window.CNB_APP.state.panX = 700; window.CNB_APP.state.panY = 1400; window.CNB_APP.render();
      const svg = document.querySelector('#panelSvg'); const c = window.CNB_APP.state.model.components[0]; const group = document.querySelector(`[data-component-id="${c.id}"]`); const rect = group.getBoundingClientRect(); const start = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; const point = svg.createSVGPoint(); point.x = start.x; point.y = start.y; const local = point.matrixTransform(svg.getScreenCTM().inverse()); const before = { x: c.x, y: c.y, offsetX: local.x - c.x, offsetY: window.CNB_APP.state.model.enclosure.height - local.y - c.y }; return { start, before, id: c.id, ctm: svg.getScreenCTM().toString() };
    });
    const expected = await page.evaluate((drag) => {
      const svg = document.querySelector('#panelSvg'); const point = svg.createSVGPoint(); point.x = drag.start.x + 50; point.y = drag.start.y + 25; const local = point.matrixTransform(svg.getScreenCTM().inverse()); const model = { x: local.x, y: window.CNB_APP.state.model.enclosure.height - local.y }; return { x: Math.round((model.x - drag.before.offsetX) / 5) * 5, y: Math.round((model.y - drag.before.offsetY) / 5) * 5 };
    }, drag);
    await page.mouse.move(drag.start.x, drag.start.y); await page.mouse.down(); await page.mouse.move(drag.start.x + 50, drag.start.y + 25); await page.mouse.up();
    const after = await page.evaluate((id) => { const c = window.CNB_APP.state.model.components.find((item) => item.id === id); return { x: c.x, y: c.y }; }, drag.id);
    if (JSON.stringify(after) !== JSON.stringify(expected)) console.error({ drag, expected, after }); assert.deepEqual(after, expected); evidence.drag_after_zoom_pan_expected_mm_correct = true; evidence.snap_after_zoom_pan = after.x % 5 === 0 && after.y % 5 === 0;

    const preview = catalog.records.find((record) => record.source_group === 'radica-dxf' && record.unit_confidence === 'unknown' && record.preview_segment_count > 0 && !record.physical_footprint_id);
    assert.ok(preview);
    const previewResponse = await fetch(`${base}/api/catalog/reviews`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source_asset_id: preview.source_asset_id, representation_id: preview.representation_id, confirmed_view: 'front', physical_width_mm: 23.8125, physical_height_mm: 95.25, reviewed_at: '2026-09-16T00:00:00.000Z' }) });
    assert.equal(previewResponse.status, 200); const approved = await previewResponse.json(); const footprintId = approved.review.physical_footprint_id; assert.ok(footprintId);
    const revisionResponse = await fetch(`${base}/api/catalog/reviews`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source_asset_id: preview.source_asset_id, representation_id: preview.representation_id, confirmed_view: 'front', physical_width_mm: 23.8125, physical_height_mm: 95.25, reviewed_at: '2026-09-16T00:00:00.000Z' }) }); const revised = await revisionResponse.json(); assert.equal(revised.idempotent, true); assert.equal(revised.review.review_provenance.review_revision, 1); assert.equal(revised.catalog.review_history.length, 0); evidence.review_idempotent_when_unchanged = true;
    const reload = await (await fetch(`${base}/api/catalog`)).json(); assert.equal(reload.records.find((record) => record.source_asset_id === preview.source_asset_id).physical_footprint_id, footprintId); evidence.review_persisted_after_reload = true;
    const audit = spawnSync('python', ['scripts/audit_catalog.py', 'catalog'], { cwd: root, encoding: 'utf8', timeout: 180000 }); assert.equal(audit.status, 0, audit.stderr); const afterAudit = await (await fetch(`${base}/api/catalog`)).json(); assert.equal(afterAudit.records.find((record) => record.source_asset_id === preview.source_asset_id).physical_footprint_id, footprintId); evidence.review_survives_catalog_regeneration = true; evidence.physical_footprint_id_stable = true;

    await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.CNB_APP.state.assetCatalog.length === 58); const persisted = await page.evaluate((id) => window.CNB_APP.state.assetCatalog.find((record) => (record.source_asset_id || record.id) === id), preview.source_asset_id); assert.equal(persisted.physical_footprint_id, footprintId);
    await page.evaluate((id) => { document.querySelector('#assetTab').click(); const card = document.querySelector(`.asset-card[data-asset-id="${id}"]`); card.click(); }, preview.source_asset_id); await page.waitForFunction(() => document.querySelector('#assetReviewForm'));
    const model = normalizeModel({ enclosure: { width: 400, height: 700 }, mountingPlate: { x: 20, y: 20, width: 360, height: 660 }, components: [{ id: 'approved', tag: '-PLC1', name: 'Review-approved test footprint', x: 123, y: 456, width: 23.8125, height: 95.25, mounting: 'Plate' }] });
    const exportBounds = componentBoundsFromDxf(exportDxf(model)); assert.equal(exportBounds.minX, 123); assert.equal(exportBounds.minY, 456); assert.equal(exportBounds.maxX, 146.8125); assert.equal(exportBounds.maxY, 551.25); evidence.approved_dxf_bounds_correct = true;
    const blocked = await page.evaluate(() => { const c = window.CNB_APP.state.model.components[0]; c.assetId = 'preview-only'; window.CNB_APP.exportFormat('dxf'); return document.querySelector('#toast').textContent; }); assert.match(blocked, /Export blocked/); evidence.preview_export_blocked = true;
    const approvedToast = await page.evaluate((id) => { window.CNB_APP.loadModel(window.CNB_APP.scenarios.starter(), 'approved export'); const c = window.CNB_APP.state.model.components[0]; c.assetId = id; c.footprintRef = window.CNB_APP.state.assetCatalog.find((record) => (record.source_asset_id || record.id) === id).physical_footprint_id; c.width = 23.8125; c.height = 95.25; window.CNB_APP.render(); window.CNB_APP.exportFormat('dxf'); return document.querySelector('#toast').textContent; }, preview.source_asset_id); assert.match(approvedToast, /DXF exported/); evidence.approved_export_allowed = true;
    const productionHashAfter = fs.existsSync(productionReviewPath) ? crypto.createHash('sha256').update(fs.readFileSync(productionReviewPath)).digest('hex') : null; assert.equal(productionHashAfter, productionReviewHash); evidence.production_review_store_unchanged_by_tests = true; evidence.zoom_roundtrips = zoomRoundtrips;
    fs.mkdirSync(path.join(root, 'evidence', 'test-logs'), { recursive: true }); fs.writeFileSync(path.join(root, 'evidence', 'test-logs', 'cad-final-hardening.json'), `${JSON.stringify({ ok: true, ...evidence }, null, 2)}\n`);
    console.log(JSON.stringify({ ok: true, ...evidence }, null, 2));
  } finally { await browser.close(); child.kill(); fs.rmSync(tempReviewDir, { recursive: true, force: true }); }
})().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
