'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { auditDxf } = require('../packages/cad-export');

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/audit_dxf.cjs <file.dxf>');
  process.exit(2);
}
const resolved = path.resolve(input);
if (!fs.existsSync(resolved)) {
  console.error(`DXF not found: ${resolved}`);
  process.exit(2);
}
const result = auditDxf(fs.readFileSync(resolved, 'utf8'));
console.log(JSON.stringify({ file: resolved, ...result }, null, 2));
process.exit(result.valid ? 0 : 1);
