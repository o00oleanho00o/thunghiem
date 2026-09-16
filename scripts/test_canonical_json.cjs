'use strict';
const assert = require('node:assert/strict');
const { canonicalize, canonicalStringify, canonicalHash } = require('../apps/web/canonical-json.js');

const source = { placement: { x: 10, y: 20 }, footprint: { clearance_mm: 5 }, terminals: [{ id: 'L1' }] };
const reordered = { terminals: [{ id: 'L1' }], footprint: { clearance_mm: 5 }, placement: { y: 20, x: 10 } };
assert.equal(canonicalHash(source), canonicalHash(reordered));
assert.notEqual(canonicalHash(source), canonicalHash({ ...source, placement: { x: 11, y: 20 } }));
assert.notEqual(canonicalHash(source), canonicalHash({ ...source, footprint: { clearance_mm: 6 } }));
assert.notEqual(canonicalHash(source), canonicalHash({ ...source, terminals: [{ id: 'L2' }] }));
assert.equal(canonicalStringify(source), JSON.stringify(canonicalize(source)));
console.log(JSON.stringify({ ok: true, hash: canonicalHash(source), key_order_stable: true, nested_changes_detected: true }, null, 2));
