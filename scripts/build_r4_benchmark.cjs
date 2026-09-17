const fs = require('node:fs');
const path = require('node:path');
const { exportDxf, exportSvg } = require('../packages/cad-export');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'benchmarks', 'r4-real-dxf-composer');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'catalog/generated/catalog-assets.json'), 'utf8'));
const vectorManifest = JSON.parse(fs.readFileSync(path.join(root, 'catalog/generated/vector-cache-manifest.json'), 'utf8'));
const chosenIds = ['source-a0a9c0419df569bb', 'source-67d0e317f239396c', 'source-33c324f4df97c631', 'source-fe6d18f6b8ce400b', 'source-e2454df537a9505c', 'source-66748a98dbbdcf49', 'source-7ab1640d1d97df20', 'source-a0a9f79675c3f78e'];
const records = chosenIds.map((id) => catalog.records.find((item) => item.source_asset_id === id)).filter(Boolean);
records.forEach((record) => { const vector = vectorManifest.records.find((item) => item.source_asset_id === record.source_asset_id); record.vector_cache_ref = vector?.vector_cache_ref; });
const cacheRoot = path.join(root, 'catalog/generated/vector-cache');
function model(label) {
  return { schemaVersion: 'eir-0.1', units: 'source-units-preview', project: { id: 'r4-real-dxf-composer', name: label, revision: 'A' }, enclosure: { id: 'generic-engineering-enclosure', name: 'Generic engineering enclosure · preview only', width: 1600, height: 1100, depth: 300 }, mountingPlate: { id: 'plate-main', x: 50, y: 50, width: 1500, height: 1000 }, rails: [{ id: 'rail-top', x: 90, y: 850, length: 1420, height: 7.5 }, { id: 'rail-mid', x: 90, y: 600, length: 1420, height: 7.5 }, { id: 'rail-low', x: 90, y: 350, length: 1420, height: 7.5 }], ducts: [{ id: 'duct-left', x: 55, y: 100, width: 28, height: 800 }, { id: 'duct-right', x: 1517, y: 100, width: 28, height: 800 }], components: [], connections: [], metadata: { r4PreviewMode: true, previewCadAssets: true, authoritative: false, truthNote: 'Real source geometry; identity and physical mapping are unresolved.' } };
}
function addComponents(target, yOffset) {
  records.forEach((record, index) => {
    const bbox = record.source_bbox;
    target.components.push({ id: `r4-${index + 1}`, tag: `-CAD${index + 1}`, name: record.candidate_description, kind: 'cad_asset', manufacturer: record.manufacturer || 'Siemens candidate', partNumber: `CANDIDATE-${record.source_asset_id}`, group: record.product_family || 'Siemens candidate', width: bbox.width, height: bbox.height, depth: 1, x: 100 + (index % 4) * 350, y: yOffset - (index >= 4 ? 250 : 0), rotation: 0, railId: index === 6 || index === 7 ? null : (index < 4 ? 'rail-top' : 'rail-mid'), mounting: index === 6 || index === 7 ? 'Plate' : 'DIN', locked: false, assetId: record.source_asset_id, source_asset_id: record.source_asset_id, cadGeometryRef: record.vector_cache_ref, metadata: { geometryStatus: 'source_verified', identityStatus: 'candidate_needs_review', physicalMappingStatus: 'unknown', sourceHash: record.sha256, placementCapable: false } });
  });
}
function writeJson(name, value) { fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n'); }
fs.mkdirSync(path.join(out, 'exports'), { recursive: true });
const initial = model('R4 initial real CAD preview'); addComponents(initial, 820); writeJson('source-assets.json', records.map((record) => ({ source_asset_id: record.source_asset_id, relative_path: record.relative_path, sha256: record.sha256, representation_id: record.representation_id, entity_count: record.entity_count, candidate_view: record.candidate_view, geometry_status: 'source_verified', identity_status: 'candidate_needs_review', physical_mapping_status: 'unknown' }))); writeJson('approved-mappings.json', { status: 'blocked', reason: 'No selected asset has defensible exact-product physical mapping; source units and candidate filenames are insufficient.', mappings: [] }); writeJson('cabinet.json', initial.enclosure); writeJson('initial-layout.json', initial);
const auto = JSON.parse(JSON.stringify(initial)); auto.project.revision = 'AUTO'; auto.components.forEach((component, index) => { component.x = 110 + (index % 4) * 350; component.y = index < 4 ? 800 : 540; component.railId = component.mounting === 'DIN' ? (index < 4 ? 'rail-top' : 'rail-mid') : null; }); writeJson('auto-layout.json', auto);
const manual = JSON.parse(JSON.stringify(auto)); manual.project.revision = 'MANUAL'; manual.components[0].x = 500; manual.components[0].y = 800; manual.components[0].locked = true; writeJson('manual-layout.json', manual);
const regenerated = JSON.parse(JSON.stringify(manual)); regenerated.project.revision = 'REGENERATED'; regenerated.components.slice(1).forEach((component, index) => { component.x = 110 + (index % 4) * 350; component.y = index < 3 ? 800 : 540; }); writeJson('regenerated-layout.json', regenerated);
writeJson('validation.json', { valid: true, mode: 'preview', authoritative: false, warnings: [{ code: 'R4_PHYSICAL_MAPPING_BLOCKED', message: 'All selected components remain preview-only because physical mapping is unknown.' }], component_count: regenerated.components.length });
function enriched(candidate) { const copy = JSON.parse(JSON.stringify(candidate)); copy.components.forEach((component) => { const cachePath = path.join(root, component.cadGeometryRef.replaceAll('/', path.sep)); const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')); const record = records.find((item) => item.source_asset_id === component.assetId); component.cadGeometry = cache.geometry; component.cadGeometryBounds = record.source_bbox; component.cadGeometryScale = 1; }); return copy; }
for (const [name, candidate] of [['r4-preview', regenerated]]) { const enrichedCandidate = enriched(candidate); fs.writeFileSync(path.join(out, 'exports', `${name}.dxf`), exportDxf(enrichedCandidate)); fs.writeFileSync(path.join(out, 'exports', `${name}.svg`), exportSvg(enrichedCandidate)); }
console.log(JSON.stringify({ asset_count: catalog.asset_count, selected: records.length, placement_capable: 0, preview_only: records.length, exported_components: regenerated.components.length }, null, 2));
