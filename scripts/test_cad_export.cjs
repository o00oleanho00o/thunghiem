'use strict';

const assert = require('node:assert/strict');
const { normalizeModel, exportDxf, exportSvg, auditDxf, renderDxfToSvg } = require('../packages/cad-export');

const model = normalizeModel({
  project: { id: 'test', name: 'Exporter test', revision: 'T1' },
  enclosure: { width: 600, height: 800, depth: 250 },
  mountingPlate: { x: 30, y: 30, width: 540, height: 740 },
  rails: [{ id: 'rail-a', x: 50, y: 650, length: 500 }],
  ducts: [{ id: 'duct-a', x: 50, y: 50, width: 35, height: 550 }],
  components: [
    { id: 'main', tag: '-Q1', name: 'Main breaker', kind: 'breaker', x: 100, y: 650, width: 55, height: 80, terminals: [{ id: '1' }, { id: '2' }] },
    { id: 'load', tag: '-M1', name: 'Motor', kind: 'motor', x: 300, y: 400, width: 80, height: 50 },
  ],
  connections: [{ id: 'n1', from: 'main', to: 'load', label: 'L1' }],
});
assert.equal(model.units, 'mm');
assert.equal(model.components.length, 2);
const dxf = exportDxf(model);
assert.equal(exportDxf(model), dxf, 'DXF export must be deterministic');
const audit = auditDxf(dxf);
assert.equal(audit.valid, true, JSON.stringify(audit));
assert.ok(audit.counts.LINE >= 20);
assert.ok(audit.counts.TEXT >= 3);
assert.match(dxf, /AC1009/);
const svg = exportSvg(model);
assert.equal(exportSvg(model), svg, 'SVG export must be deterministic');
assert.match(svg, /<svg/);
assert.match(svg, /-Q1/);
const rendered = renderDxfToSvg(dxf);
assert.match(rendered, /DXF render/);
assert.match(rendered, /<line/);
const broken = auditDxf(dxf.replace(/0\r\nEOF\r\n?$/, ''));
assert.equal(broken.valid, false);
console.log(JSON.stringify({ ok: true, dxfBytes: Buffer.byteLength(dxf), svgBytes: Buffer.byteLength(svg), entities: audit.entityCount, counts: audit.counts }, null, 2));
