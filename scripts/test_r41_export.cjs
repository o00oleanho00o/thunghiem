const fs = require('node:fs');
const base = process.env.CNB_R41_URL || 'http://127.0.0.1:4177';
const gold = JSON.parse(fs.readFileSync('catalog/generated/device-gold-set.json', 'utf8')).profiles[0];
const model = {
  schemaVersion: 'eir-0.1',
  project: { id: 'r41-export-check', name: 'R4.1 export check', revision: 'A' },
  enclosure: { id: 'cabinet-1', name: 'Control cabinet', width: 400, height: 300, depth: 300 },
  mountingPlate: { id: 'plate-1', x: 20, y: 20, width: 360, height: 260 },
  rails: [], ducts: [], connections: [],
  metadata: { r41DeviceObjectClosure: true, previewCadAssets: true, authoritative: false },
  components: [{ id: 'gold-export-1', tag: '-G1', name: gold.display_name, kind: 'plc', group: 'Siemens', x: 80, y: 40, width: gold.derived_bounds.width, height: gold.derived_bounds.height, depth: 50, rotation: 0, mounting: gold.mounting_type, assetId: gold.gold_id, goldId: gold.gold_id, source_asset_id: gold.source_asset_id, footprintRef: null, color: '#14b8a6' }]
};

(async () => {
  const request = (format) => fetch(`${base}/api/export`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, format }) });
  const svgResponse = await request('svg');
  const svg = await svgResponse.text();
  if (!svgResponse.ok || (svg.match(/class="cad-geometry"/g) || []).length < 20) throw new Error(`gold SVG export missing transient geometry: ${svgResponse.status}`);
  const dxfResponse = await request('dxf');
  const dxf = await dxfResponse.text();
  if (!dxfResponse.ok || (dxf.match(/CAD_GEOMETRY/g) || []).length < 20) throw new Error(`gold DXF export missing transient geometry: ${dxfResponse.status}`);
  fs.mkdirSync('benchmarks/r4-1-device-object-closure/exports', { recursive: true });
  fs.writeFileSync('benchmarks/r4-1-device-object-closure/exports/gold-preview.svg', svg);
  fs.writeFileSync('benchmarks/r4-1-device-object-closure/exports/gold-preview.dxf', dxf);
  console.log(JSON.stringify({ ok: true, svgCadGeometry: (svg.match(/class="cad-geometry"/g) || []).length, dxfCadGeometry: (dxf.match(/CAD_GEOMETRY/g) || []).length }, null, 2));
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
