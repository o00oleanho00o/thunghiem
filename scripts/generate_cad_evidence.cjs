'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { normalizeModel, exportDxf, exportSvg, auditDxf } = require('../packages/cad-export');

const root = path.resolve(__dirname, '..');
const out = {
  dxf: path.join(root, 'evidence', 'generated-dxf'),
  svg: path.join(root, 'evidence', 'generated-svg'),
  json: path.join(root, 'evidence', 'generated-json'),
  logs: path.join(root, 'evidence', 'test-logs'),
};
Object.values(out).forEach((directory) => fs.mkdirSync(directory, { recursive: true }));

function component(id, tag, name, kind, x, y, width, height, group, color) {
  return { id, tag, name, kind, x, y, width, height, group, color, terminals: [{ id: 'L' }, { id: 'R' }] };
}

function mccModel() {
  const components = [
    component('main', '-QF1', 'MCCB 250A', 'breaker', 110, 1760, 90, 120, 'Incoming', '#2563eb'),
  ];
  const connections = [];
  for (let index = 0; index < 6; index += 1) {
    const x = 120 + (index % 3) * 210;
    const y = 1340 - Math.floor(index / 3) * 280;
    const breaker = `f${index + 1}-breaker`;
    const contactor = `f${index + 1}-contactor`;
    const overload = `f${index + 1}-overload`;
    components.push(component(breaker, `-Q${index + 2}`, `MCB ${index + 1}`, 'breaker', x, y, 50, 80, `Feeder ${index + 1}`, '#3b82f6'));
    components.push(component(contactor, `-K${index + 1}`, `Contactor ${index + 1}`, 'contactor', x + 65, y, 70, 90, `Feeder ${index + 1}`, '#0ea5e9'));
    components.push(component(overload, `-F${index + 1}`, `Overload ${index + 1}`, 'overload', x + 150, y, 60, 80, `Feeder ${index + 1}`, '#14b8a6'));
    connections.push({ from: 'main', to: breaker, label: `L${index + 1}` });
    connections.push({ from: breaker, to: contactor, label: 'A1' });
    connections.push({ from: contactor, to: overload, label: 'T1' });
  }
  for (let index = 0; index < 12; index += 1) {
    components.push(component(`terminal-${index + 1}`, `-X${Math.floor(index / 4) + 1}:${(index % 4) + 1}`, 'Feed terminal', 'terminal', 120 + index * 48, 180, 35, 45, 'Terminals', '#64748b'));
  }
  return normalizeModel({
    schemaVersion: 'eir-0.1',
    project: { id: 'mcc-6-motor', name: 'MCC 6 motor evidence', revision: 'A' },
    enclosure: { width: 800, height: 2000, depth: 300 },
    mountingPlate: { x: 50, y: 50, width: 700, height: 1900 },
    rails: [
      { id: 'rail-top', x: 90, y: 1780, length: 620 },
      { id: 'rail-mid', x: 90, y: 1360, length: 620 },
      { id: 'rail-low', x: 90, y: 950, length: 620 },
      { id: 'rail-terminal', x: 90, y: 230, length: 620 },
    ],
    ducts: [
      { id: 'duct-left', x: 60, y: 120, width: 35, height: 1780 },
      { id: 'duct-right', x: 705, y: 120, width: 35, height: 1780 },
      { id: 'duct-mid', x: 90, y: 1660, width: 620, height: 35, orientation: 'horizontal' },
    ],
    components,
    connections,
  });
}

const model = mccModel();
const jsonPath = path.join(out.json, 'mcc-6-motor.canonical.json');
const dxfPath = path.join(out.dxf, 'mcc-6-motor.dxf');
const svgPath = path.join(out.svg, 'mcc-6-motor.svg');
fs.writeFileSync(jsonPath, `${JSON.stringify(model, null, 2)}\n`);
const dxf = exportDxf(model);
fs.writeFileSync(dxfPath, dxf);
fs.writeFileSync(svgPath, exportSvg(model));
const audit = auditDxf(dxf);
const report = { scenario: 'mcc-6-motor', jsonPath, dxfPath, svgPath, componentCount: model.components.length, audit };
fs.writeFileSync(path.join(out.logs, 'mcc-6-motor-export.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!audit.valid) process.exit(1);
