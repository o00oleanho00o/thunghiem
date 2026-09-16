'use strict';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
  }
  return value;
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function canonicalHash(value) {
  const crypto = require('node:crypto');
  return crypto.createHash('sha256').update(canonicalStringify(value), 'utf8').digest('hex');
}

module.exports = { canonicalize, canonicalStringify, canonicalHash };
