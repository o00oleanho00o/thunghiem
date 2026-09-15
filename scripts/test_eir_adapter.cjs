'use strict';

const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'apps', 'web', 'eir-adapter.js'), 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context);
const adapt = context.window.CnbEirAdapter.adapt;
const result = adapt({
  schemaVersion: 'eir.v1',
  project: { id: 'adapter-test', name: 'Adapter test', revision: 'B' },
  enclosure: { id: 'cab-1', width: 500, height: 700, depth: 250, plate: { id: 'plate-1', x: 25, y: 25, width: 450, height: 650 }, rails: [{ id: 'r1', x: 50, y: 600, length: 400 }] },
  parts: [{ id: 'part-breaker', mpn: 'TEST-BRK', manufacturer: 'CNB', description: 'Test breaker', footprint2d: { width: 36, height: 72 } }],
  devices: [{ id: 'dev-1', deviceTag: '-Q1', partId: 'part-breaker', group: 'Power', terminals: [{ id: '1' }, { id: '2' }] }],
  placements: [{ id: 'dev-1', x: 80, y: 580, rotation: 0, railId: 'r1' }],
  connections: [{ id: 'net-1', from_device: 'dev-1', to_device: 'dev-1', netName: 'L1' }],
});
assert.equal(result.schemaVersion, 'eir.v1');
assert.equal(result.enclosure.width, 500);
assert.equal(result.mountingPlate.width, 450);
assert.equal(result.components[0].id, 'dev-1');
assert.equal(result.components[0].partNumber, 'TEST-BRK');
assert.equal(result.components[0].width, 36);
assert.equal(result.components[0].x, 80);
assert.equal(result.components[0].railId, 'r1');
assert.equal(result.connections[0].from, 'dev-1');
assert.equal(result.connections[0].to, 'dev-1');
console.log(JSON.stringify({ ok: true, schemaVersion: result.schemaVersion, component: result.components[0], connection: result.connections[0] }, null, 2));

const pythonEir = JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'examples', 'mcc-6-motor', 'project.json'), 'utf8'));
const pythonResult = adapt(pythonEir);
assert.equal(pythonResult.schemaVersion, 'eir.v1');
assert.equal(pythonResult.enclosure.width, 800);
assert.equal(pythonResult.enclosure.height, 2000);
assert.equal(pythonResult.mountingPlate.x, 50);
assert.equal(pythonResult.components.length, pythonEir.devices.length);
assert.ok(pythonResult.components.some((component) => component.partNumber === 'CNB-MCCB-250'));
assert.ok(pythonResult.components.some((component) => component.railId));
assert.equal(pythonResult.connections[0].from, pythonEir.connections[0].from_device);
console.log(JSON.stringify({ pythonEir: { components: pythonResult.components.length, connections: pythonResult.connections.length, firstPart: pythonResult.components[0].partNumber, plate: pythonResult.mountingPlate }, ok: true }, null, 2));
