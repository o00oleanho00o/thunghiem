const fs = require('node:fs');
const model = JSON.parse(fs.readFileSync('benchmarks/r4-real-dxf-composer/regenerated-layout.json', 'utf8'));
(async () => {
  const response = await fetch('http://127.0.0.1:4177/api/export', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, format: 'dxf' }) });
  const text = await response.text();
  if (!response.ok) throw new Error(`preview export failed ${response.status}: ${text.slice(0, 500)}`);
  if (!text.includes('CAD_GEOMETRY') || (text.match(/\r?\nARC\r?\n/g) || []).length < 100) throw new Error('real CAD geometry missing from preview export');
  console.log(JSON.stringify({ ok: true, status: response.status, bytes: Buffer.byteLength(text), cadGeometryEntities: (text.match(/CAD_GEOMETRY/g) || []).length }, null, 2));
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
