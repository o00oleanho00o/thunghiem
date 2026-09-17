const fs = require('node:fs');
const model = JSON.parse(fs.readFileSync('benchmarks/r4-real-dxf-composer/regenerated-layout.json', 'utf8'));
(async () => {
  const request = (format) => fetch('http://127.0.0.1:4177/api/export', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, format }) });
  const dxfResponse = await request('dxf');
  const dxf = await dxfResponse.text();
  if (!dxfResponse.ok) throw new Error(`preview DXF export failed ${dxfResponse.status}: ${dxf.slice(0, 500)}`);
  if (!dxf.includes('CAD_GEOMETRY') || (dxf.match(/\r?\nARC\r?\n/g) || []).length < 100) throw new Error('real CAD geometry missing from preview DXF export');
  const svgResponse = await request('svg');
  const svg = await svgResponse.text();
  if (!svgResponse.ok) throw new Error(`preview SVG export failed ${svgResponse.status}: ${svg.slice(0, 500)}`);
  const svgGeometryElements = (svg.match(/class="cad-geometry"/g) || []).length;
  if (svgGeometryElements < 100) throw new Error(`real CAD geometry missing from preview SVG export (${svgGeometryElements} elements)`);
  console.log(JSON.stringify({ ok: true, dxfStatus: dxfResponse.status, dxfBytes: Buffer.byteLength(dxf), cadGeometryEntities: (dxf.match(/CAD_GEOMETRY/g) || []).length, svgStatus: svgResponse.status, svgBytes: Buffer.byteLength(svg), svgGeometryElements }, null, 2));
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
