'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const reservePort = () => new Promise((resolve) => { const socket = net.createServer(); socket.listen(0, '127.0.0.1', () => { const port = socket.address().port; socket.close(() => resolve(port)); }); });
const hashFile = (file) => fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
async function ready(base, child) { for (let i = 0; i < 80; i += 1) { if (child.exitCode !== null) throw new Error(`server exited (${child.exitCode})`); try { if ((await fetch(`${base}/api/health`)).ok) return; } catch (_) {} await new Promise((resolve) => setTimeout(resolve, 100)); } throw new Error('server timeout'); }
async function post(base, pathName, body) { return fetch(`${base}${pathName}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
function componentBounds(text) {
  const lines = String(text).split(/\r?\n/); const points = []; let inEntities = false; let current = null;
  const flush = () => { if (current?.type === 'LINE' && current.layer === 'COMPONENT') points.push({ x: current.x, y: current.y }, { x: current.x2, y: current.y2 }); current = null; };
  for (let i = 0; i < lines.length - 1; i += 2) { const code = lines[i].trim(); const value = lines[i + 1]; if (code === '2' && value === 'ENTITIES') { inEntities = true; continue; } if (inEntities && code === '0' && value === 'ENDSEC') { flush(); inEntities = false; continue; } if (!inEntities) continue; if (code === '0') { flush(); current = { type: value, layer: '0' }; continue; } if (!current) continue; if (code === '8') current.layer = value; else if (code === '10') current.x = Number(value); else if (code === '20') current.y = Number(value); else if (code === '11') current.x2 = Number(value); else if (code === '21') current.y2 = Number(value); }
  flush(); return { minX: Math.min(...points.map((point) => point.x)), minY: Math.min(...points.map((point) => point.y)), maxX: Math.max(...points.map((point) => point.x)), maxY: Math.max(...points.map((point) => point.y)) };
}

(async () => {
  const productionReviewPath = path.join(root, 'catalog', 'review', 'catalog-review.json'); const productionBefore = hashFile(productionReviewPath);
  const tempReviewDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cnb-r1-closure-')); const tempReviewPath = path.join(tempReviewDir, 'catalog-review.json'); const port = await reservePort(); const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.join(root, 'apps/web/server.js'), String(port)], { cwd: root, windowsHide: true, stdio: 'ignore', env: { ...process.env, CNB_CATALOG_REVIEW_PATH: tempReviewPath } });
  const report = {};
  try {
    await ready(base, child); const catalog = await (await fetch(`${base}/api/catalog`)).json(); const asset = catalog.records.find((record) => record.source_group === 'radica-dxf' && record.preview_segment_count > 0); assert.ok(asset);
    const invalidBefore = hashFile(tempReviewPath);
    for (const invalid of [
      { source_asset_id: 'unknown-source', representation_id: asset.representation_id, confirmed_view: 'front', physical_width_mm: 1, physical_height_mm: 1 },
      { source_asset_id: asset.source_asset_id, representation_id: 'wrong-representation', confirmed_view: 'front', physical_width_mm: 1, physical_height_mm: 1 },
      { source_asset_id: asset.source_asset_id, representation_id: asset.representation_id, confirmed_view: 'front', physical_width_mm: 1, physical_height_mm: 1, physical_depth_mm: 0 },
      { source_asset_id: asset.source_asset_id, representation_id: asset.representation_id, confirmed_view: 'unknown', physical_width_mm: 1, physical_height_mm: 1 },
    ]) { assert.equal((await post(base, '/api/catalog/reviews', invalid)).status, 400); }
    assert.equal(hashFile(tempReviewPath), invalidBefore); report.invalid_review_does_not_mutate_store = true;
    const source = asset.source_bbox; const width = Number(source.width) / 2; const height = Number(source.height) / 3; const depth = 12.5; const payload = { source_asset_id: asset.source_asset_id, representation_id: asset.representation_id, confirmed_view: 'front', physical_width_mm: width, physical_height_mm: height, physical_depth_mm: depth, reviewed_at: '2026-09-16T00:00:00.000Z' };
    const approvedResponse = await post(base, '/api/catalog/reviews', payload); assert.equal(approvedResponse.status, 200); const approved = await approvedResponse.json(); const footprint = approved.review.physical_footprint; assert.equal(typeof footprint.source_to_physical.scale_x, 'number'); assert.equal(typeof footprint.source_to_physical.scale_y, 'number'); assert.notEqual(footprint.source_to_physical.scale_x, 1); report.source_to_physical_numeric = true; report.source_to_physical_non_unit_scale_tested = true;
    const min = { x: source.min_x, y: source.min_y }; const max = { x: source.max_x, y: source.max_y }; const transform = footprint.source_to_physical; const map = (point) => ({ x: point.x * transform.scale_x + transform.translate_x_mm, y: point.y * transform.scale_y + transform.translate_y_mm }); assert.ok(Math.abs(map(min).x) < 1e-8 && Math.abs(map(min).y) < 1e-8); assert.ok(Math.abs(map(max).x - width) < 1e-8 && Math.abs(map(max).y - height) < 1e-8);
    const same = await (await post(base, '/api/catalog/reviews', payload)).json(); assert.equal(same.idempotent, true); assert.equal(same.review.review_provenance.review_revision, 1); assert.equal(same.catalog.review_history.length, 0); report.review_idempotent_when_unchanged = true;
    const changedPayload = { ...payload, physical_width_mm: width * 1.1 }; const changed = await (await post(base, '/api/catalog/reviews', changedPayload)).json(); assert.equal(changed.review.review_provenance.review_revision, 2); assert.equal(changed.catalog.review_history.length, 1); report.review_revision_increments_when_changed = true;
    const effective = await (await fetch(`${base}/api/catalog`)).json(); const effectiveRecord = effective.records.find((record) => record.source_asset_id === asset.source_asset_id); assert.equal(effectiveRecord.physical_footprint_id, changed.review.physical_footprint_id);
    const approvedModel = { enclosure: { width: 400, height: 700 }, mountingPlate: { x: 20, y: 20, width: 360, height: 660 }, components: [{ id: 'persisted-device', tag: '-PLC1', x: 123, y: 456, width: 999, height: 999, assetId: asset.source_asset_id, footprintRef: changed.review.physical_footprint_id }] };
    const previewExport = await post(base, '/api/export', { format: 'dxf', model: { ...approvedModel, components: [{ ...approvedModel.components[0], footprintRef: null }] } }); assert.equal(previewExport.status, 400); report.backend_blocks_unapproved_export = true;
    const fakeExport = await post(base, '/api/export', { format: 'dxf', model: { ...approvedModel, components: [{ ...approvedModel.components[0], footprintRef: 'footprint-fake' }] } }); assert.equal(fakeExport.status, 400); report.backend_blocks_fake_footprint_ref = true;
    const approvedExport = await post(base, '/api/export', { format: 'dxf', model: approvedModel }); assert.equal(approvedExport.status, 200); const bounds = componentBounds(await approvedExport.text()); assert.equal(bounds.minX, 123); assert.equal(bounds.minY, 456); assert.ok(Math.abs(bounds.maxX - (123 + changed.review.physical_width_mm)) < 0.001); assert.ok(Math.abs(bounds.maxY - (456 + changed.review.physical_height_mm)) < 0.001); report.backend_allows_approved_export = true; report.persisted_footprint_to_dxf_bounds_correct = true;
    const svgRejected = await post(base, '/api/export', { format: 'svg', model: { ...approvedModel, components: [{ ...approvedModel.components[0], footprintRef: 'footprint-fake' }] } }); assert.equal(svgRejected.status, 400); const svgApproved = await post(base, '/api/export', { format: 'svg', model: approvedModel }); assert.equal(svgApproved.status, 200);
    const genericExport = await post(base, '/api/export', { format: 'dxf', model: { enclosure: { width: 300, height: 400 }, components: [{ id: 'generic', x: 40, y: 50, width: 20, height: 30 }] } }); assert.equal(genericExport.status, 200); report.generic_component_export_still_works = true;
    const audit = spawnSync('python', ['scripts/audit_catalog.py', 'catalog'], { cwd: root, encoding: 'utf8', timeout: 180000 }); assert.equal(audit.status, 0, audit.stderr); const generated = JSON.parse(fs.readFileSync(path.join(root, 'catalog', 'generated', 'catalog-assets.json'), 'utf8')); const generatedRecord = generated.records.find((record) => record.source_asset_id === asset.source_asset_id); assert.equal(generatedRecord.physical_footprint_id, null); assert.equal(generatedRecord.review_state, 'needs-unit-review'); const afterAuditEffective = await (await fetch(`${base}/api/catalog`)).json(); assert.equal(afterAuditEffective.records.find((record) => record.source_asset_id === asset.source_asset_id).physical_footprint_id, changed.review.physical_footprint_id); report.generated_manifest_remains_review_free = true;
    report.production_review_store_unchanged_by_tests = hashFile(productionReviewPath) === productionBefore; assert.equal(report.production_review_store_unchanged_by_tests, true);
    fs.mkdirSync(path.join(root, 'evidence', 'test-logs'), { recursive: true }); fs.writeFileSync(path.join(root, 'evidence', 'test-logs', 'cad-r1-closure.json'), `${JSON.stringify({ ok: true, ...report }, null, 2)}\n`); console.log(JSON.stringify({ ok: true, ...report }, null, 2));
  } finally { child.kill(); fs.rmSync(tempReviewDir, { recursive: true, force: true }); }
})().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
