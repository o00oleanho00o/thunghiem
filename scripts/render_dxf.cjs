'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { auditDxf, renderDxfToSvg } = require('../packages/cad-export');

const input = process.argv[2];
const output = process.argv[3] || (input ? input.replace(/\.dxf$/i, '.svg') : 'rendered-dxf.svg');
if (!input) {
  console.error('Usage: node scripts/render_dxf.cjs <file.dxf> [output.svg]');
  process.exit(2);
}
const inputPath = path.resolve(input);
const outputPath = path.resolve(output);
if (!fs.existsSync(inputPath)) {
  console.error(`DXF not found: ${inputPath}`);
  process.exit(2);
}
const dxf = fs.readFileSync(inputPath, 'utf8');
const audit = auditDxf(dxf);
if (!audit.valid) {
  console.error(JSON.stringify(audit, null, 2));
  process.exit(1);
}
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, renderDxfToSvg(dxf), 'utf8');
console.log(JSON.stringify({ input: inputPath, output: outputPath, audit }, null, 2));
