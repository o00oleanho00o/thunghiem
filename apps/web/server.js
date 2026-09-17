'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeModel, exportDxf, exportSvg, auditDxf } = require('../../packages/cad-export');
const { adapt: adaptEir } = require('./eir-adapter.js');
const { canonicalStringify, canonicalHash } = require('./canonical-json.js');

const root = __dirname;
const projectRoot = path.resolve(__dirname, '../..');
const catalogRoot = path.resolve(__dirname, '../../catalog');
const catalogManifestPath = path.join(catalogRoot, 'generated', 'catalog-assets.json');
const deviceGoldSetPath = path.join(catalogRoot, 'generated', 'device-gold-set.json');
const verifiedDeviceSetPath = path.join(catalogRoot, 'generated', 'verified-device-set.json');
const catalogReviewDir = path.join(catalogRoot, 'review');
const catalogReviewPath = process.env.CNB_CATALOG_REVIEW_PATH
  ? path.resolve(process.env.CNB_CATALOG_REVIEW_PATH)
  : path.join(catalogReviewDir, 'catalog-review.json');
const port = Number(process.env.CNB_WEB_PORT || process.argv[2] || 4173);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.dxf': 'application/dxf',
  '.md': 'text/markdown; charset=utf-8',
};

function send(response, status, body, type = 'text/plain; charset=utf-8') {
  response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  response.end(body);
}

function bodyFrom(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; if (body.length > 5_000_000) reject(new Error('request too large')); });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function stableId(prefix, ...parts) {
  const crypto = require('node:crypto');
  return `${prefix}-${crypto.createHash('sha256').update(parts.map((part) => part == null ? '' : String(part)).join('|')).digest('hex').slice(0, 16)}`;
}

function readReviews() {
  if (!fs.existsSync(catalogReviewPath)) return { schema_version: 'catalog-review.v1', reviews: [], history: [] };
  const parsed = JSON.parse(fs.readFileSync(catalogReviewPath, 'utf8'));
  return { schema_version: 'catalog-review.v1', reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [], history: Array.isArray(parsed.history) ? parsed.history : [] };
}

function writeReviews(store) {
  fs.mkdirSync(path.dirname(catalogReviewPath), { recursive: true });
  const temporary = `${catalogReviewPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, catalogReviewPath);
}

function readEffectiveCatalog() {
  const manifest = JSON.parse(fs.readFileSync(catalogManifestPath, 'utf8'));
  const store = readReviews();
  const byAsset = new Map(store.reviews.map((review) => [review.source_asset_id, review]));
  const records = manifest.records.map((record) => {
    const review = byAsset.get(record.source_asset_id || record.id);
    if (!review) return record;
    return {
      ...record,
      review_state: review.review_state,
      candidate_view: review.confirmed_view || record.candidate_view,
      unit_confidence: review.unit_confidence,
      unit_source: review.unit_source,
      source_units: review.source_units || 'millimetres',
      source_units_code: 4,
      physical_width_mm: review.physical_width_mm,
      physical_height_mm: review.physical_height_mm,
      physical_depth_mm: review.physical_depth_mm ?? null,
      physical_footprint_id: review.physical_footprint_id,
      physical_footprint: review.physical_footprint,
      approval: review.review_provenance,
      review_revision: review.review_provenance?.review_revision || 1,
    };
  });
  return { ...manifest, records, reviews: store.reviews, review_history: store.history };
}

function validateReview(payload, manifest) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { error: 'review payload must be an object' };
  const sourceAssetId = payload.source_asset_id;
  const record = manifest.records.find((item) => (item.source_asset_id || item.id) === sourceAssetId);
  if (!record) return { error: 'unknown source_asset_id' };
  if (!payload.representation_id || payload.representation_id !== record.representation_id) return { error: 'unknown or mismatched representation_id' };
  if (!['front', 'side', 'top'].includes(payload.confirmed_view)) return { error: 'approval requires front, side, or top view' };
  const width = Number(payload.physical_width_mm); const height = Number(payload.physical_height_mm);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return { error: 'physical_width_mm and physical_height_mm must be greater than zero' };
  const depth = payload.physical_depth_mm == null || payload.physical_depth_mm === '' ? null : Number(payload.physical_depth_mm);
  if (depth !== null && (!Number.isFinite(depth) || depth <= 0)) return { error: 'physical_depth_mm must be greater than zero when provided' };
  if (record.drawing_sheet) return { error: 'drawing-sheet assets require manual extraction before approval' };
  return { record, width, height, depth };
}

function effectiveRecordForAsset(sourceAssetId, catalog) {
  return catalog.records.find((record) => (record.source_asset_id || record.id) === sourceAssetId) || null;
}

function effectiveGoldProfile(goldId) {
  if (!goldId || !fs.existsSync(deviceGoldSetPath)) return null;
  try {
    const manifest = JSON.parse(fs.readFileSync(deviceGoldSetPath, 'utf8'));
    return manifest.profiles?.find((profile) => profile.gold_id === goldId) || null;
  } catch (_) { return null; }
}

function attachCadGeometry(model, catalog) {
  const cacheRoot = path.resolve(catalogRoot, 'generated', 'vector-cache');
  model.components.forEach((component) => {
    const sourceAssetId = component.assetId || component.source_asset_id || null;
    if (!sourceAssetId) return;
    const record = effectiveRecordForAsset(sourceAssetId, catalog);
    const gold = effectiveGoldProfile(component.goldId || sourceAssetId);
    const cachePath = record
      ? path.resolve(catalogRoot, 'generated', 'vector-cache', `${sourceAssetId}.json`)
      : gold
        ? path.resolve(catalogRoot, 'generated', 'device-gold-cache', path.basename(gold.cache_ref))
        : null;
    const allowedRoot = record ? cacheRoot : path.resolve(catalogRoot, 'generated', 'device-gold-cache');
    if (!cachePath || !cachePath.startsWith(allowedRoot + path.sep) || !fs.existsSync(cachePath)) return;
    try {
      const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      component.cadGeometry = Array.isArray(cache.geometry) ? cache.geometry : [];
      component.cadGeometryBounds = record?.source_bbox || cache.bounds || null;
      component.cadGeometryScale = Number(component.cadGeometryScale || 1);
    } catch (_) {
      // Invalid cache remains an explicit missing-geometry export condition.
    }
  });
  return model;
}

function enforceCadApproval(model, catalog, authoritative = true) {
  for (const component of model.components) {
    const sourceAssetId = component.assetId || component.source_asset_id || null;
    const footprintRef = component.footprintRef || component.footprint_ref || null;
    // Legacy/internal catalog refs such as `footprints/MCB_3P_16A` are not
    // imported CAD assets. A persisted physical footprint must carry its
    // source asset ID so the server can verify both sides of the reference.
    if (!sourceAssetId && (!footprintRef || !String(footprintRef).startsWith('footprint-'))) continue;
    const record = effectiveRecordForAsset(sourceAssetId, catalog);
    if (authoritative && (!record || record.review_state !== 'approved-footprint' || !record.physical_footprint_id || footprintRef !== record.physical_footprint_id)) {
      return { error: 'unapproved CAD asset in authoritative export', component_id: component.id, source_asset_id: sourceAssetId, footprint_ref: footprintRef };
    }
    // Authoritative export uses persisted physical dimensions, never client dimensions.
    component.assetId = sourceAssetId;
    if (!record) continue;
    component.footprintRef = record.physical_footprint_id;
    if (record && record.review_state === 'approved-footprint') {
      component.width = Number(record.physical_width_mm);
      component.height = Number(record.physical_height_mm);
    }
  }
  return null;
}

function rectFor(component) {
  const rotated = [90, 270].includes(Number(component.rotation));
  return { x: Number(component.x), y: Number(component.y), width: rotated ? Number(component.height) : Number(component.width), height: rotated ? Number(component.width) : Number(component.height) };
}

function intersects(a, b, clearance = 0) {
  return !(a.x + a.width + clearance <= b.x || b.x + b.width + clearance <= a.x || a.y + a.height + clearance <= b.y || b.y + b.height + clearance <= a.y);
}

function authoritativeValidation(model) {
  const errors = []; const warnings = [];
  const plate = model.mountingPlate;
  const rails = new Map(model.rails.map((rail) => [rail.id, rail]));
  const rects = new Map(model.components.map((component) => [component.id, rectFor(component)]));
  const tags = new Map();
  model.components.forEach((component) => {
    if (tags.has(component.tag)) errors.push({ code: 'E007', entity_id: component.id, message: `duplicate device tag ${component.tag}` });
    tags.set(component.tag, component.id);
    if (!component.partNumber && model.metadata && model.metadata.authoritative) errors.push({ code: 'E009', entity_id: component.id, message: 'authoritative component has unknown manufacturer part number' });
    if (model.metadata && model.metadata.authoritative) {
      const metadata = component.metadata || {};
      const requiredProvenance = ['widthProvenance', 'heightProvenance', 'depthProvenance', 'mountingProvenance'];
      requiredProvenance.forEach((field) => { if (!metadata[field] || !['vendor_verified', 'document_verified', 'human_measured', 'trusted_secondary'].includes(metadata[field].status)) errors.push({ code: 'E010', entity_id: component.id, message: `${field} is missing authoritative provenance`, evidence: { field, provenance: metadata[field] || null } }); });
      if (metadata.clearanceStatus === 'unknown' || metadata.clearanceStatus == null) warnings.push({ code: 'V004_UNVERIFIED_CLEARANCE', entity_id: component.id, message: 'clearance is unknown; only a non-vendor engineering default may be used' });
      if (metadata.terminalModelStatus === 'unknown') warnings.push({ code: 'V008_UNVERIFIED_TERMINAL_MODEL', entity_id: component.id, message: 'terminal model is unknown; topology and terminal identifiers are not manufacturing verified' });
      if (!metadata.serviceAccessDirection || metadata.serviceAccessDirection === 'unknown' || Number(metadata.serviceAccessDepthMm || 0) <= 0) warnings.push({ code: 'V005_UNVERIFIED_SERVICE_ACCESS', entity_id: component.id, message: 'service access is unknown; corridor clearance is not manufacturing verified' });
    }
    const rect = rects.get(component.id);
    if (!rect || rect.width <= 0 || rect.height <= 0) errors.push({ code: 'E010', entity_id: component.id, message: 'missing physical footprint' });
    else if (rect.x < plate.x || rect.y < plate.y || rect.x + rect.width > plate.x + plate.width || rect.y + rect.height > plate.y + plate.height) errors.push({ code: 'E001', entity_id: component.id, message: 'component lies outside mounting plate', evidence: { rect, plate } });
    if ((component.mounting || '').toLowerCase().includes('din')) {
      if (!component.railId || !rails.has(component.railId)) errors.push({ code: 'E003', entity_id: component.id, message: 'DIN component is not attached to a rail' });
      else { const rail = rails.get(component.railId); if (rect.x < rail.x || rect.x + rect.width > rail.x + rail.length) errors.push({ code: 'E003', entity_id: component.id, message: 'component extends beyond DIN rail' }); }
    }
    if (model.metadata && model.metadata.authoritative && component.assetId && (!component.footprintRef || !String(component.footprintRef).startsWith('footprint-'))) errors.push({ code: 'E010', entity_id: component.id, message: 'CAD asset has no approved physical footprint' });
  });
  const entries = [...rects.entries()];
  for (let i = 0; i < entries.length; i += 1) for (let j = i + 1; j < entries.length; j += 1) {
    const [leftId, left] = entries[i]; const [rightId, right] = entries[j];
    if (intersects(left, right)) errors.push({ code: 'E002', entity_id: leftId, message: `component overlaps ${rightId}`, evidence: { left, right } });
    const leftComponent = model.components.find((item) => item.id === leftId); const rightComponent = model.components.find((item) => item.id === rightId);
    const clearance = Math.max(Number(leftComponent?.metadata?.clearanceMm || 0), Number(rightComponent?.metadata?.clearanceMm || 0));
    if (clearance > 0 && intersects(left, right, clearance)) errors.push({ code: 'E004', entity_id: leftId, message: `required clearance to ${rightId} is insufficient`, evidence: { clearance, left, right, rule_source: leftComponent?.metadata?.clearanceStatus || rightComponent?.metadata?.clearanceStatus || 'unknown', source_artifact_id: leftComponent?.metadata?.clearanceArtifactId || rightComponent?.metadata?.clearanceArtifactId || null, policy_id: (leftComponent?.metadata?.clearanceStatus === 'engineering_default' || rightComponent?.metadata?.clearanceStatus === 'engineering_default') ? 'CNB-CLEARANCE-DEFAULT-V1' : null } });
  }
  model.ducts.forEach((duct) => entries.forEach(([id, rect]) => { const d = { x: duct.x, y: duct.y, width: duct.width, height: duct.height }; if (intersects(d, rect)) errors.push({ code: 'E006', entity_id: duct.id, message: `duct collides with ${id}` }); }));
  model.components.forEach((component) => {
    const direction = component.metadata?.serviceAccessDirection;
    const depth = Number(component.metadata?.serviceAccessDepthMm || 0);
    if (!direction || direction === 'unknown' || !depth || !component.terminals?.length) { return; }
    const rect = rects.get(component.id); let corridor;
    if (direction === 'left') corridor = { x: rect.x - depth, y: rect.y, width: depth, height: rect.height };
    else if (direction === 'right') corridor = { x: rect.x + rect.width, y: rect.y, width: depth, height: rect.height };
    else if (direction === 'top') corridor = { x: rect.x, y: rect.y + rect.height, width: rect.width, height: depth };
    else corridor = { x: rect.x, y: rect.y - depth, width: rect.width, height: depth };
    entries.forEach(([otherId, other]) => { if (otherId !== component.id && intersects(corridor, other)) errors.push({ code: 'E005', entity_id: component.id, message: `service access corridor is blocked by ${otherId}`, evidence: { corridor, other } }); });
    model.ducts.forEach((duct) => { const d = { x: duct.x, y: duct.y, width: duct.width, height: duct.height }; if (intersects(corridor, d)) errors.push({ code: 'E005', entity_id: component.id, message: `service access corridor is blocked by duct ${duct.id}`, evidence: { corridor, duct: d } }); });
  });
  model.connections.forEach((connection) => { if (!rects.has(connection.from) || !rects.has(connection.to)) errors.push({ code: 'E008', entity_id: connection.id, message: 'connection references an unknown device' }); });
  return { valid: errors.length === 0, errors, warnings };
}

const eirRevisions = new Map();

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (requestUrl.pathname === '/api/health') return send(response, 200, JSON.stringify({ ok: true, service: 'cnb-electrical-lab-web' }), mime['.json']);
    if (requestUrl.pathname === '/api/catalog' && request.method === 'GET') {
      if (!fs.existsSync(catalogManifestPath)) return send(response, 404, JSON.stringify({ error: 'catalog manifest missing; run scripts/audit_catalog.py catalog' }), mime['.json']);
      return send(response, 200, JSON.stringify(readEffectiveCatalog()), mime['.json']);
    }
    if (requestUrl.pathname === '/api/catalog/gold' && request.method === 'GET') {
      if (!fs.existsSync(deviceGoldSetPath)) return send(response, 404, JSON.stringify({ error: 'device gold set missing; run scripts/build_r41_gold_set.py catalog' }), mime['.json']);
      return send(response, 200, fs.readFileSync(deviceGoldSetPath), mime['.json']);
    }
    if (requestUrl.pathname === '/api/catalog/verified' && request.method === 'GET') {
      if (!fs.existsSync(verifiedDeviceSetPath)) return send(response, 404, JSON.stringify({ error: 'verified device set missing; run scripts/build_r42_verified_device.py catalog' }), mime['.json']);
      return send(response, 200, fs.readFileSync(verifiedDeviceSetPath), mime['.json']);
    }
    const goldPreviewMatch = requestUrl.pathname.match(/^\/api\/catalog\/gold-preview\/([A-Za-z0-9-]+)$/);
    if (goldPreviewMatch && request.method === 'GET') {
      if (!fs.existsSync(deviceGoldSetPath)) return send(response, 404, 'Device gold set missing');
      const gold = JSON.parse(fs.readFileSync(deviceGoldSetPath, 'utf8')).profiles?.find((item) => item.gold_id === goldPreviewMatch[1]);
      if (!gold || !gold.preview_ref) return send(response, 404, 'Gold preview not found');
      const previewPath = path.resolve(catalogRoot, 'generated', 'device-gold-cache', path.basename(gold.preview_ref));
      const previewRoot = path.resolve(catalogRoot, 'generated', 'device-gold-cache');
      if (!previewPath.startsWith(previewRoot + path.sep) || !fs.existsSync(previewPath)) return send(response, 404, 'Gold preview not found');
      return send(response, 200, fs.readFileSync(previewPath), mime['.svg']);
    }
    if (requestUrl.pathname === '/api/benchmark/r2' && request.method === 'GET') {
      const benchmarkPath = path.resolve(root, '../../benchmarks/r2-real-cabinet/artifacts/r2-reference-cabinet.json');
      if (!benchmarkPath.startsWith(path.resolve(root, '../..') + path.sep) || !fs.existsSync(benchmarkPath)) return send(response, 404, JSON.stringify({ error: 'R2 benchmark not generated; run scripts/build_r2_benchmark.py' }), mime['.json']);
      return send(response, 200, fs.readFileSync(benchmarkPath), mime['.json']);
    }
    if (requestUrl.pathname === '/api/benchmark/r2b' && request.method === 'GET') {
      const benchmarkPath = path.resolve(root, '../../benchmarks/r2b-verified-siemens-cabinet/exports/r2b-verified-cabinet.json');
      if (!benchmarkPath.startsWith(path.resolve(root, '../..') + path.sep) || !fs.existsSync(benchmarkPath)) return send(response, 404, JSON.stringify({ error: 'R2B benchmark not generated; run scripts/build_r2b_benchmark.py' }), mime['.json']);
      return send(response, 200, fs.readFileSync(benchmarkPath), mime['.json']);
    }
    if (requestUrl.pathname === '/api/benchmark/r3' && request.method === 'GET') {
      const benchmarkPath = path.resolve(root, '../../benchmarks/r3-engineering-truth-cabinet/regenerated-layout.json');
      if (!fs.existsSync(benchmarkPath)) return send(response, 404, JSON.stringify({ error: 'R3 benchmark not generated' }), mime['.json']);
      return send(response, 200, fs.readFileSync(benchmarkPath), mime['.json']);
    }
    if (requestUrl.pathname === '/api/r3/products' && request.method === 'GET') {
      const productPath = path.resolve(root, '../../catalog/r3/products.json');
      if (!fs.existsSync(productPath)) return send(response, 404, JSON.stringify({ error: 'R3 product catalog missing' }), mime['.json']);
      return send(response, 200, fs.readFileSync(productPath), mime['.json']);
    }
    if (requestUrl.pathname === '/api/eir/revisions' && request.method === 'GET') {
      return send(response, 200, JSON.stringify({ revisions: [...eirRevisions.values()] }), mime['.json']);
    }
    const revisionMatch = requestUrl.pathname.match(/^\/api\/eir\/revisions\/([A-Za-z0-9-]+)$/);
    if (revisionMatch && request.method === 'GET') {
      const record = eirRevisions.get(revisionMatch[1]);
      if (!record) return send(response, 404, JSON.stringify({ error: 'revision not found' }), mime['.json']);
      return send(response, 200, JSON.stringify(record), mime['.json']);
    }
    if (requestUrl.pathname === '/api/eir/revisions' && request.method === 'POST') {
      const payload = JSON.parse(await bodyFrom(request)); const source = payload.eir || payload.model;
      if (!source || typeof source !== 'object') return send(response, 400, JSON.stringify({ error: 'eir object is required' }), mime['.json']);
      const next = JSON.parse(JSON.stringify(source)); const command = payload.command || {};
      const placements = Array.isArray(next.placements) ? next.placements : [];
      const placement = placements.find((item) => item.device_id === command.device_id);
      if (command.type === 'move' && placement) { placement.x = Number(command.x); placement.y = Number(command.y); if (command.rotation != null) placement.rotation = Number(command.rotation); }
      if (command.type === 'lock' && placement) placement.locked = Boolean(command.locked ?? true);
      const device = Array.isArray(next.devices) ? next.devices.find((item) => item.id === command.device_id) : null;
      if (command.type === 'set-tag' && device && command.tag) device.tag = String(command.tag);
      const revision = `r3-${canonicalHash(next).slice(0, 12)}`;
      const record = { revision, saved_at: new Date().toISOString(), eir: next, command, canonical_hash: canonicalHash(next), canonical_json: canonicalStringify(next) };
      eirRevisions.set(revision, record); return send(response, 200, JSON.stringify(record), mime['.json']);
    }
    if (requestUrl.pathname === '/api/catalog/reviews' && request.method === 'GET') return send(response, 200, JSON.stringify(readReviews()), mime['.json']);
    if (requestUrl.pathname === '/api/catalog/reviews' && request.method === 'POST') {
      if (!fs.existsSync(catalogManifestPath)) return send(response, 404, JSON.stringify({ error: 'catalog manifest missing' }), mime['.json']);
      const payload = JSON.parse(await bodyFrom(request)); const manifest = JSON.parse(fs.readFileSync(catalogManifestPath, 'utf8')); const checked = validateReview(payload, manifest);
      if (checked.error) return send(response, 400, JSON.stringify({ error: checked.error }), mime['.json']);
      const store = readReviews(); const existingIndex = store.reviews.findIndex((review) => review.source_asset_id === payload.source_asset_id); const existing = existingIndex >= 0 ? store.reviews[existingIndex] : null;
      const sameValues = existing && existing.representation_id === payload.representation_id && existing.confirmed_view === payload.confirmed_view && existing.physical_width_mm === checked.width && existing.physical_height_mm === checked.height && (existing.physical_depth_mm ?? null) === checked.depth;
      if (sameValues) return send(response, 200, JSON.stringify({ ok: true, idempotent: true, review: existing, catalog: readEffectiveCatalog() }), mime['.json']);
      const revision = (existing?.review_provenance?.review_revision || 0) + 1;
      const sourceBounds = checked.record.source_bbox || checked.record.bbox || {};
      const scaleX = Number(sourceBounds.width) > 0 ? checked.width / Number(sourceBounds.width) : null;
      const scaleY = Number(sourceBounds.height) > 0 ? checked.height / Number(sourceBounds.height) : null;
      if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY)) return send(response, 400, JSON.stringify({ error: 'source bbox is not suitable for a physical transform' }), mime['.json']);
      const footprintId = stableId('footprint', payload.source_asset_id, payload.representation_id, payload.confirmed_view, checked.width, checked.height, checked.depth ?? '');
      const review = { source_asset_id: payload.source_asset_id, representation_id: payload.representation_id, review_state: 'approved-footprint', confirmed_view: payload.confirmed_view, physical_width_mm: checked.width, physical_height_mm: checked.height, physical_depth_mm: checked.depth, unit_confidence: 'confirmed-by-review', unit_source: 'reviewer', source_units: 'millimetres', product_identity_id: payload.product_identity_id || null, physical_footprint_id: footprintId, physical_footprint: { physical_footprint_id: footprintId, source_asset_id: payload.source_asset_id, representation_id: payload.representation_id, view: payload.confirmed_view, width_mm: checked.width, height_mm: checked.height, depth_mm: checked.depth, source_to_physical: { scale_x: scaleX, scale_y: scaleY, translate_x_mm: -Number(sourceBounds.min_x || 0) * scaleX, translate_y_mm: -Number(sourceBounds.min_y || 0) * scaleY, source_bbox: { min_x: Number(sourceBounds.min_x || 0), min_y: Number(sourceBounds.min_y || 0), width: Number(sourceBounds.width), height: Number(sourceBounds.height) } }, provenance: { unit_source: 'reviewer', review_source: 'manual-web-review' } }, review_provenance: { review_source: 'manual-web-review', reviewed_at: payload.reviewed_at || new Date().toISOString(), review_revision: revision } };
      if (existing) store.history.push(existing);
      if (existingIndex >= 0) store.reviews[existingIndex] = review; else store.reviews.push(review);
      store.reviews.sort((a, b) => a.source_asset_id.localeCompare(b.source_asset_id)); store.history.sort((a, b) => a.source_asset_id.localeCompare(b.source_asset_id) || (a.review_provenance?.review_revision || 0) - (b.review_provenance?.review_revision || 0)); writeReviews(store);
      return send(response, 200, JSON.stringify({ ok: true, review, catalog: readEffectiveCatalog() }), mime['.json']);
    }
    const previewMatch = requestUrl.pathname.match(/^\/api\/catalog\/preview\/([A-Za-z0-9-]+)$/);
    if (previewMatch && request.method === 'GET') {
      if (!fs.existsSync(catalogManifestPath)) return send(response, 404, 'Catalog manifest missing');
      const manifest = JSON.parse(fs.readFileSync(catalogManifestPath, 'utf8'));
      const record = manifest.records.find((item) => (item.source_asset_id || item.id) === previewMatch[1]);
      if (!record || !record.preview_ref) return send(response, 404, 'Preview not found');
      const previewPath = path.resolve(catalogRoot, 'generated', record.preview_ref);
      if (!previewPath.startsWith(path.resolve(catalogRoot, 'generated') + path.sep) || !fs.existsSync(previewPath)) return send(response, 404, 'Preview not found');
      return send(response, 200, fs.readFileSync(previewPath), mime['.svg']);
    }
    if (requestUrl.pathname === '/api/export' && request.method === 'POST') {
      const payload = JSON.parse(await bodyFrom(request));
      const candidate = payload.model || payload;
      const model = normalizeModel(candidate && (candidate.devices || candidate.schema_version || candidate.schemaVersion === 'eir.v1') ? adaptEir(candidate) : candidate);
      attachCadGeometry(model, readEffectiveCatalog());
      const format = payload.format || 'dxf';
      if (format === 'dxf' || format === 'svg' || format === 'audit') {
        const gate = enforceCadApproval(model, readEffectiveCatalog(), Boolean(model.metadata?.authoritative));
        if (gate) return send(response, 400, JSON.stringify(gate), mime['.json']);
        const validation = authoritativeValidation(model);
        if (model.metadata?.authoritative && !validation.valid) return send(response, 422, JSON.stringify({ error: 'authoritative export blocked by engineering validation', validation }), mime['.json']);
      }
      if (format === 'dxf') return send(response, 200, exportDxf(model), mime['.dxf']);
      if (format === 'svg') return send(response, 200, exportSvg(model), mime['.svg']);
      if (format === 'audit') return send(response, 200, JSON.stringify(auditDxf(exportDxf(model)), null, 2), mime['.json']);
      return send(response, 400, JSON.stringify({ error: `unsupported format: ${format}` }), mime['.json']);
    }
    // Documentation and evidence are read-only project artefacts. Keep the
    // editor static root separate while exposing linked reports in the web UI.
    if (request.method === 'GET' && (requestUrl.pathname.startsWith('/docs/') || requestUrl.pathname.startsWith('/evidence/'))) {
      const relative = decodeURIComponent(requestUrl.pathname).replace(/^\//, '');
      const resolved = path.resolve(projectRoot, relative);
      if (!resolved.startsWith(projectRoot + path.sep) || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) return send(response, 404, 'Documentation file not found');
      return send(response, 200, fs.readFileSync(resolved), mime[path.extname(resolved).toLowerCase()] || 'text/plain; charset=utf-8');
    }
    let pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === '/') pathname = '/index.html';
    const resolved = path.resolve(root, `.${pathname}`);
    if (!resolved.startsWith(root + path.sep) || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) return send(response, 404, 'Not found');
    return send(response, 200, fs.readFileSync(resolved), mime[path.extname(resolved).toLowerCase()] || 'application/octet-stream');
  } catch (error) {
    return send(response, 500, JSON.stringify({ error: error.message }), mime['.json']);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`CNB Electrical Lab web editor listening at http://127.0.0.1:${port}`);
});

module.exports = server;
