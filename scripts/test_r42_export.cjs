const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const base = process.env.CNB_R42_URL || 'http://127.0.0.1:4177';
const profile = JSON.parse(fs.readFileSync('catalog/generated/verified-device-set.json', 'utf8')).candidates[0];
const model = {
  schemaVersion: 'eir-0.1', project: { id: 'r42-ktp700-export', name: 'R4.2 KTP700 mapping review', revision: 'A' },
  enclosure: { id: 'cabinet-1', name: 'Control cabinet door', width: 600, height: 500, depth: 300 },
  mountingPlate: { id: 'door-1', x: 20, y: 20, width: 560, height: 460 }, rails: [], ducts: [], connections: [],
  metadata: { r42VerificationReview: true, previewCadAssets: true, authoritative: false },
  components: [{ id: 'r42-ktp700-export', tag: '-G1', name: profile.type_designation, kind: 'hmi', group: 'Siemens HMI', x: 193, y: 171, width: profile.physical_footprint.width_mm, height: profile.physical_footprint.height_mm, depth: profile.physical_footprint.depth_mm, rotation: 0, mounting: profile.mounting_type, assetId: 'gold-hmi-ktp700', goldId: 'gold-hmi-ktp700', source_asset_id: profile.source_asset_id, color: '#f59e0b' }]
};

(async () => {
  const request = (format) => fetch(`${base}/api/export`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, format }) });
  const svgResponse = await request('svg'); const svg = await svgResponse.text();
  const dxfResponse = await request('dxf'); const dxf = await dxfResponse.text();
  if (!svgResponse.ok || !dxfResponse.ok) throw new Error(`export failed svg=${svgResponse.status} dxf=${dxfResponse.status}`);
  const svgCount = (svg.match(/class="cad-geometry"/g) || []).length; const dxfCount = (dxf.match(/CAD_GEOMETRY/g) || []).length;
  if (svgCount < 20 || dxfCount < 20) throw new Error(`real vector geometry missing svg=${svgCount} dxf=${dxfCount}`);
  fs.mkdirSync('benchmarks/r4-2-first-verified-real-device/exports', { recursive: true });
  fs.writeFileSync('benchmarks/r4-2-first-verified-real-device/exports/ktp700-review.svg', svg);
  fs.writeFileSync('benchmarks/r4-2-first-verified-real-device/exports/ktp700-review.dxf', dxf);
  execFileSync('python', ['scripts/audit_dxf_ezdxf.py', 'benchmarks/r4-2-first-verified-real-device/exports/ktp700-review.dxf'], { stdio: ['ignore', fs.openSync('benchmarks/r4-2-first-verified-real-device/exports/ktp700-review.audit.json', 'w'), 'inherit'] });
  console.log(JSON.stringify({ ok: true, svgCount, dxfCount, reopened: true }, null, 2));
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
