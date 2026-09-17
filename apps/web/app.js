(function bootstrap() {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const snap = (value, step = 10) => Math.round(Number(value) / step) * step;
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  const library = [
    { kind: 'breaker', label: 'Circuit breaker', short: 'CB', width: 45, height: 80, group: 'Power', color: '#3b82f6', mounting: 'DIN' },
    { kind: 'mccb', label: 'Main MCCB', short: 'M', width: 90, height: 120, group: 'Incoming', color: '#2563eb', mounting: 'Plate' },
    { kind: 'contactor', label: 'Contactor', short: 'K', width: 55, height: 90, group: 'Motor starter', color: '#0ea5e9', mounting: 'DIN' },
    { kind: 'overload', label: 'Overload relay', short: 'OL', width: 50, height: 75, group: 'Motor starter', color: '#14b8a6', mounting: 'DIN' },
    { kind: 'plc', label: 'PLC CPU', short: 'PLC', width: 75, height: 100, group: 'Control', color: '#8b5cf6', mounting: 'DIN' },
    { kind: 'terminal', label: 'Terminal block', short: 'X', width: 35, height: 45, group: 'Terminals', color: '#64748b', mounting: 'DIN' },
    { kind: 'powersupply', label: '24 V power supply', short: 'PS', width: 65, height: 100, group: 'Control', color: '#a855f7', mounting: 'DIN' },
    { kind: 'relay', label: 'Interface relay', short: 'R', width: 35, height: 75, group: 'Control', color: '#c084fc', mounting: 'DIN' },
  ];
  const catalog = Object.fromEntries(library.map((item) => [item.kind, item]));

  function componentFrom(kind, index, x, y) {
    const spec = catalog[kind] || catalog.breaker;
    return { id: `device-${String(index).padStart(3, '0')}`, tag: kind === 'terminal' ? `-X${index}` : `-${spec.short === 'M' ? 'QF' : spec.short}${index}`, name: spec.label, kind: spec.kind, group: spec.group, width: spec.width, height: spec.height, depth: 50, x, y, rotation: 0, railId: null, locked: false, terminals: [{ id: '1' }, { id: '2' }], mounting: spec.mounting, color: spec.color, partNumber: `CNB-${kind.toUpperCase()}-${String(index).padStart(3, '0')}` };
  }

  function baseModel(name, width = 800, height = 1200) {
    return CnbCadExport.normalizeModel({ schemaVersion: 'eir-0.1', project: { id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, revision: 'A' }, enclosure: { id: 'cabinet-1', name: 'Control cabinet', width, height, depth: 300 }, mountingPlate: { id: 'plate-1', x: 50, y: 50, width: width - 100, height: height - 100 }, rails: [{ id: 'rail-top', x: 90, y: height - 160, length: width - 180 }, { id: 'rail-mid', x: 90, y: height - 430, length: width - 180 }, { id: 'rail-low', x: 90, y: height - 700, length: width - 180 }, { id: 'rail-bottom', x: 90, y: 140, length: width - 180 }], ducts: [{ id: 'duct-left', x: 58, y: 100, width: 32, height: height - 200 }, { id: 'duct-right', x: width - 90, y: 100, width: 32, height: height - 200 }, { id: 'duct-top', x: 90, y: height - 300, width: width - 180, height: 30, orientation: 'horizontal' }], components: [], connections: [] });
  }

  function starterScenario() {
    const model = baseModel('Starter panel', 600, 900);
    model.rails = [{ id: 'rail-top', x: 80, y: 700, length: 440 }, { id: 'rail-bottom', x: 80, y: 170, length: 440 }];
    model.ducts = [{ id: 'duct-left', x: 55, y: 100, width: 25, height: 700 }, { id: 'duct-right', x: 520, y: 100, width: 25, height: 700 }];
    model.components = [componentFrom('mccb', 1, 115, 690), componentFrom('breaker', 2, 230, 690), componentFrom('contactor', 3, 300, 690), componentFrom('overload', 4, 370, 690), componentFrom('terminal', 5, 220, 190), componentFrom('terminal', 6, 270, 190), componentFrom('terminal', 7, 320, 190)];
    model.connections = [{ id: 'wire-1', from: 'device-001', to: 'device-002', label: 'L1' }, { id: 'wire-2', from: 'device-002', to: 'device-003', label: 'T1' }, { id: 'wire-3', from: 'device-003', to: 'device-004', label: 'T2' }, { id: 'wire-4', from: 'device-004', to: 'device-005', label: 'PE' }];
    return model;
  }

  function mccScenario() {
    const model = baseModel('MCC 6 motor', 800, 2000);
    model.components = [componentFrom('mccb', 1, 120, 1760)];
    for (let motor = 1; motor <= 6; motor += 1) {
      const x = 120 + ((motor - 1) % 3) * 210; const y = 1260 - Math.floor((motor - 1) / 3) * 300; const base = motor * 3 - 1;
      model.components.push(componentFrom('breaker', base, x, y), componentFrom('contactor', base + 1, x + 62, y), componentFrom('overload', base + 2, x + 130, y));
      model.components.at(-3).group = `Feeder ${motor}`; model.components.at(-2).group = `Feeder ${motor}`; model.components.at(-1).group = `Feeder ${motor}`;
      model.connections.push({ id: `wire-${motor}-a`, from: 'device-001', to: `device-${String(base).padStart(3, '0')}`, label: `L${motor}` }, { id: `wire-${motor}-b`, from: `device-${String(base).padStart(3, '0')}`, to: `device-${String(base + 1).padStart(3, '0')}`, label: 'A1' }, { id: `wire-${motor}-c`, from: `device-${String(base + 1).padStart(3, '0')}`, to: `device-${String(base + 2).padStart(3, '0')}`, label: 'T1' });
    }
    for (let terminal = 1; terminal <= 16; terminal += 1) model.components.push(componentFrom('terminal', 30 + terminal, 115 + ((terminal - 1) % 8) * 65, 180));
    model.connections.push({ id: 'wire-pe', from: 'device-019', to: 'device-031', label: 'PE' });
    return model;
  }

  function plcScenario() {
    const model = baseModel('PLC control cabinet', 700, 1300);
    model.components = [componentFrom('breaker', 1, 115, 1050), componentFrom('powersupply', 2, 190, 1040), componentFrom('plc', 3, 290, 1030), componentFrom('relay', 4, 390, 1035), componentFrom('relay', 5, 435, 1035)];
    for (let terminal = 1; terminal <= 12; terminal += 1) model.components.push(componentFrom('terminal', 10 + terminal, 110 + ((terminal - 1) % 6) * 70, 190));
    model.connections = [{ id: 'p1', from: 'device-001', to: 'device-002', label: '24V+' }, { id: 'p2', from: 'device-002', to: 'device-003', label: '24V+' }, { id: 'p3', from: 'device-003', to: 'device-004', label: 'DO1' }, { id: 'p4', from: 'device-004', to: 'device-011', label: 'X1' }];
    return model;
  }

  function r4Scenario() {
    // Restrict the demo to assets whose DXF explicitly declares millimetres.
    // This is still preview-only until product identity and physical mapping
    // are independently reviewed.
    const selected = [
      ['source-d2e35ab9238f5738', 'SIMATIC HMI panel · mm declared', 420, 297, 'HMI'],
      ['source-cd095c0d1e21645e', 'SIMATIC Top Connect · mm declared', 279.4, 431.8, 'SIMATIC S7-1500'],
      ['source-a0a9f79675c3f78e', 'SINAMICS G120C · mm declared', 677.6, 349.25, 'SINAMICS'],
      ['source-a65546c5c7347b1c', 'SINAMICS V20 · mm declared', 420, 297, 'SINAMICS'],
      ['source-7ab1640d1d97df20', 'SITOP PSU · mm declared', 279.4, 431.8, 'SITOP'],
    ];
    const model = baseModel('R4 Real DXF Composer', 1600, 1100);
    model.metadata = { r4PreviewMode: true, previewCadAssets: true, authoritative: false, knownUnitOnly: true, datasetNote: 'Only source DXFs with explicit millimetre units are shown; identity and physical mapping remain under review.' };
    model.rails = [{ id: 'rail-top', x: 90, y: 850, length: 1420 }, { id: 'rail-mid', x: 90, y: 600, length: 1420 }, { id: 'rail-low', x: 90, y: 350, length: 1420 }];
    model.ducts = [{ id: 'duct-left', x: 55, y: 100, width: 28, height: 800 }, { id: 'duct-right', x: 1517, y: 100, width: 28, height: 800 }, { id: 'duct-top', x: 90, y: 920, width: 1420, height: 28, orientation: 'horizontal' }];
    model.components = selected.map(([assetId, name, width, height, family], index) => { const component = componentFrom('plc', index + 1, 115 + (index % 4) * 320, index < 4 ? 820 : 560); component.id = `r4-component-${index + 1}`; component.tag = `-CAD${index + 1}`; component.name = name; component.partNumber = `CANDIDATE-${assetId}`; component.assetId = assetId; component.source_asset_id = assetId; component.width = width; component.height = height; component.mounting = 'Plate'; component.group = family; component.metadata = { geometryStatus: 'source_verified', identityStatus: 'candidate_needs_review', physicalMappingStatus: 'unknown', sourceAssetId: assetId, sourceUnits: 'millimetres', placementCapable: false }; return component; });
    return model;
  }

  function r41Scenario() {
    const selected = [
      ['gold-hmi-ktp700', 'SIMATIC HMI KTP700 Basic DP', '6AV2123-2GA03-0AX0', 76, 220, 'HMI', 'panel-mount-candidate'],
      ['gold-sinamics-g120c', 'SINAMICS G120C drive', 'SINAMICS G120C (candidate)', 320, 105, 'SINAMICS', 'panel-mount-candidate'],
      ['gold-sinamics-v20', 'SINAMICS V20 drive', 'SINAMICS V20 (candidate)', 264, 64, 'SINAMICS', 'panel-mount-candidate'],
      ['gold-top-connect', 'SIMATIC Top Connect terminal accessory', 'SIMATIC Top Connect (candidate)', 52, 80, 'SIMATIC S7-1500', 'unknown'],
    ];
    const model = baseModel('R4.1 Gold Device Object Closure', 1000, 700);
    model.metadata = { r41DeviceObjectClosure: true, goldSetOnly: true, previewCadAssets: true, authoritative: false, datasetNote: 'Clean-cropped device candidates with explicit source millimetres; identity and physical mapping remain review-gated.' };
    model.rails = [];
    model.ducts = [{ id: 'duct-left', x: 55, y: 80, width: 28, height: 540 }, { id: 'duct-right', x: 917, y: 80, width: 28, height: 540 }];
    model.components = selected.map(([goldId, name, part, width, height, family, mounting], index) => { const component = componentFrom('plc', index + 1, 130 + (index % 2) * 420, 430 - Math.floor(index / 2) * 230); component.id = `r41-gold-${index + 1}`; component.tag = `-G${index + 1}`; component.name = name; component.partNumber = part; component.assetId = goldId; component.source_asset_id = goldId; component.goldId = goldId; component.width = width; component.height = height; component.mounting = mounting; component.group = family; component.color = '#14b8a6'; component.metadata = { goldProfileId: goldId, displayName: name, geometryStatus: 'source_verified_clean_crop', identityStatus: goldId === 'gold-hmi-ktp700' ? 'document_verified' : 'candidate_needs_review', physicalMappingStatus: 'source_mm_declared_unmapped', viewStatus: goldId === 'gold-hmi-ktp700' ? 'unknown-overview' : 'front-candidate-low-confidence', mountingType: mounting, physicalEnvelopeStatus: 'derived_crop_mm_not_approved', sourceUnits: 'millimetres', placementCapable: false }; return component; });
    return model;
  }

  const scenarios = { starter: starterScenario, mcc: mccScenario, plc: plcScenario, r4: r4Scenario, r41: r41Scenario };
  const GRID_MM = 5;
  const state = { model: mccScenario(), selectedId: null, selectedAssetId: null, selectedGoldId: null, zoom: 1, panX: 0, panY: 0, grid: true, issues: [], drag: null, pan: null, assetCatalog: [], goldCatalog: [], productCatalog: [], libraryMode: 'components' };

  function componentById(id) { return state.model.components.find((component) => component.id === id); }
  function assetKey(asset) { return asset ? (asset.source_asset_id || asset.id) : ''; }
  function assetFor(component) { return state.assetCatalog.find((asset) => assetKey(asset) === component.assetId) || null; }
  function goldFor(component) { return state.goldCatalog.find((profile) => profile.gold_id === component.goldId || profile.gold_id === component.assetId) || null; }
  function assetKnownMm(asset) { return Boolean(asset && asset.unit_confidence === 'confirmed-from-dxf' && asset.units === 'millimetres'); }
  function assetApproved(asset) { return Boolean(asset && asset.review_state === 'approved-footprint' && asset.physical_footprint_id && asset.unit_confidence && asset.physical_width_mm > 0 && asset.physical_height_mm > 0); }
  function assetPreview(asset, component = null) { const gold = component ? goldFor(component) : null; return gold ? `/api/catalog/gold-preview/${gold.gold_id}` : (asset ? `/api/catalog/preview/${assetKey(asset)}` : ''); }
  function assignDemoAssets() {
    // No source asset is authoritative until a reviewer explicitly approves it.
  }
  function rect(component) { return CnbCadExport.rect(component); }
  function pointInside(a, b) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }
  function railFor(component) { return state.model.rails.find((rail) => { const r = rect(component); const railCenter = rail.y + rail.height / 2; return r.x + r.width > rail.x && r.x < rail.x + rail.length && railCenter >= r.y && railCenter <= r.y + r.height; }); }

  function validate() {
    const model = state.model; const plate = model.mountingPlate; const issues = []; const tags = new Map();
    const authoritativeComponents = [];
    model.components.forEach((component) => {
      const componentAsset = assetFor(component);
      const componentGold = goldFor(component);
      if (componentGold && !componentGold.placement_capable) { issues.push({ code: 'E012', severity: 'warn', entity: component.id, message: `${component.tag} is a gold CAD preview; placement is not approved`, hint: 'Review identity, view, mounting and physical envelope before engineering placement.' }); return; }
      if (componentAsset && !assetApproved(componentAsset)) { issues.push({ code: 'E012', severity: 'warn', entity: component.id, message: `${component.tag} is preview-only; physical CAD is not approved`, hint: 'Confirm units, view and physical bounds before layout or manufacturing export.' }); return; }
      authoritativeComponents.push(component);
      const r = rect(component);
      if (r.x < plate.x || r.y < plate.y || r.x + r.width > plate.x + plate.width || r.y + r.height > plate.y + plate.height) issues.push({ code: 'E001', severity: 'error', entity: component.id, message: `${component.tag} is outside the mounting plate`, hint: 'Move the component inside the plate boundary.' });
      if (component.mounting === 'DIN' && model.rails.length && !railFor(component)) issues.push({ code: 'E003', severity: 'warn', entity: component.id, message: `${component.tag} is not aligned to a DIN rail`, hint: 'Snap the component to a rail or change its mounting type.' });
      if (!component.width || !component.height) issues.push({ code: 'E010', severity: 'error', entity: component.id, message: `${component.tag} has no footprint dimensions`, hint: 'Assign a 2D footprint before export.' });
      const seen = tags.get(component.tag) || []; seen.push(component.id); tags.set(component.tag, seen);
      model.ducts.forEach((duct) => { if (pointInside(r, duct)) issues.push({ code: 'E006', severity: 'warn', entity: component.id, message: `${component.tag} intersects ${duct.id}`, hint: 'Reserve clearance around wire duct.' }); });
    });
    tags.forEach((ids, tag) => { if (ids.length > 1) issues.push({ code: 'E007', severity: 'error', entity: ids[0], message: `Duplicate device tag ${tag}`, hint: 'Give each physical device a stable unique tag.' }); });
    for (let a = 0; a < authoritativeComponents.length; a += 1) for (let b = a + 1; b < authoritativeComponents.length; b += 1) {
      const left = authoritativeComponents[a]; const right = authoritativeComponents[b]; const leftRect = rect(left); const rightRect = rect(right); if (pointInside(leftRect, rightRect)) issues.push({ code: 'E002', severity: 'error', entity: left.id, message: `${left.tag} overlaps ${right.tag}`, hint: 'Separate footprints and rerun layout.' }); const clearance = Math.max(Number(left.metadata?.clearanceMm || 0), Number(right.metadata?.clearanceMm || 0)); if (clearance > 0 && pointInside({ x: leftRect.x - clearance, y: leftRect.y - clearance, width: leftRect.width + clearance * 2, height: leftRect.height + clearance * 2 }, rightRect)) issues.push({ code: 'E004', severity: 'error', entity: left.id, message: `${left.tag} has insufficient clearance to ${right.tag}`, hint: 'Respect the documented service/thermal envelope.' });
    }
    authoritativeComponents.forEach((component) => { const direction = component.metadata?.serviceAccessDirection; const depth = Number(component.metadata?.serviceAccessDepthMm || 0); if (!direction || !depth || !component.terminals?.length) return; const r = rect(component); const corridor = direction === 'right' ? { x: r.x + r.width, y: r.y, width: depth, height: r.height } : direction === 'top' ? { x: r.x, y: r.y + r.height, width: r.width, height: depth } : direction === 'left' ? { x: r.x - depth, y: r.y, width: depth, height: r.height } : { x: r.x, y: r.y - depth, width: r.width, height: depth }; authoritativeComponents.forEach((other) => { if (other.id !== component.id && pointInside(corridor, rect(other))) issues.push({ code: 'E005', severity: 'error', entity: component.id, message: `${component.tag} service access is blocked by ${other.tag}`, hint: 'Move the blocking component or change the documented access face.' }); }); });
    model.connections.forEach((connection) => { if (!componentById(connection.from)) issues.push({ code: 'E008', severity: 'warn', entity: connection.id, message: `Connection ${connection.id} has no source`, hint: 'Link the net to a device terminal.' }); if (!componentById(connection.to)) issues.push({ code: 'E008', severity: 'warn', entity: connection.id, message: `Connection ${connection.id} has no target`, hint: 'Link the net to a device terminal.' }); });
    state.issues = issues; return issues;
  }

  function clientAuditDxf(text) {
    const value = String(text || ''); const lines = value.split(/\r?\n/); const counts = {}; let entities = false;
    for (let i = 0; i < lines.length - 1; i += 2) { const code = lines[i].trim(); const next = lines[i + 1]; if (code === '2' && next === 'ENTITIES') entities = true; if (entities && code === '0' && next !== 'ENDSEC' && next !== 'EOF') counts[next] = (counts[next] || 0) + 1; }
    return { valid: value.includes('AC1009') && value.includes('ENTITIES') && /(?:^|\r?\n)0\r?\nEOF(?:\r?\n|$)/.test(value), entityCount: Object.values(counts).reduce((sum, count) => sum + count, 0), counts };
  }

  function pointerToModel(event) {
    const svg = $('#panelSvg');
    try {
      const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
      const local = point.matrixTransform(svg.getScreenCTM().inverse());
      return { x: local.x, y: state.model.enclosure.height - local.y };
    } catch (error) {
      const box = svg.getBoundingClientRect(); const x = ((event.clientX - box.left) / box.width) * state.model.enclosure.width; const yTop = ((event.clientY - box.top) / box.height) * state.model.enclosure.height; return { x, y: state.model.enclosure.height - yTop };
    }
  }

  function render() {
    const model = state.model; const svg = $('#panelSvg'); const h = model.enclosure.height; const sy = (y, height = 0) => h - y - height; const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    svg.setAttribute('viewBox', `0 0 ${model.enclosure.width} ${model.enclosure.height}`); svg.setAttribute('width', String(model.enclosure.width)); svg.setAttribute('height', String(model.enclosure.height)); svg.style.aspectRatio = `${model.enclosure.width} / ${model.enclosure.height}`; svg.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`; svg.classList.toggle('dragging', Boolean(state.drag || state.pan));
    const out = [`<defs><pattern id="minorGrid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1a2b42" stroke-width="0.7"/></pattern></defs>`, `<rect x="0" y="0" width="${model.enclosure.width}" height="${h}" fill="#09111e" stroke="#667891" stroke-width="3"/>`, state.grid ? `<rect x="0" y="0" width="${model.enclosure.width}" height="${h}" fill="url(#minorGrid)" opacity=".72"/>` : '', `<rect x="${model.mountingPlate.x}" y="${sy(model.mountingPlate.y, model.mountingPlate.height)}" width="${model.mountingPlate.width}" height="${model.mountingPlate.height}" fill="#111d2e" stroke="#526982" stroke-width="2"/>`];
    model.rails.forEach((rail) => out.push(`<g data-rail-id="${esc(rail.id)}"><rect x="${rail.x}" y="${sy(rail.y, rail.height)}" width="${rail.length}" height="${rail.height}" fill="#4b5d72" stroke="#d2deec" stroke-width="1"/><line x1="${rail.x + 5}" y1="${sy(rail.y + rail.height / 2)}" x2="${rail.x + rail.length - 5}" y2="${sy(rail.y + rail.height / 2)}" stroke="#d2deec" stroke-opacity=".35" stroke-dasharray="6 5"/></g>`));
    model.ducts.forEach((duct) => out.push(`<rect data-duct-id="${esc(duct.id)}" x="${duct.x}" y="${sy(duct.y, duct.height)}" width="${duct.width}" height="${duct.height}" fill="#1b2a3c" stroke="#70839c" stroke-dasharray="5 4"/>`));
    model.connections.forEach((connection) => { const from = componentById(connection.from); const to = componentById(connection.to); if (from && to) { const a = CnbCadExport.center(from); const b = CnbCadExport.center(to); out.push(`<line class="wire-line" x1="${a.x}" y1="${sy(a.y)}" x2="${b.x}" y2="${sy(b.y)}"/><circle cx="${a.x}" cy="${sy(a.y)}" r="2" fill="#f59e0b"/><circle cx="${b.x}" cy="${sy(b.y)}" r="2" fill="#f59e0b"/>`); } });
    model.components.forEach((component) => { const r = rect(component); const selected = component.id === state.selectedId; const asset = assetFor(component); const gold = goldFor(component); const approved = assetApproved(asset); const previewCad = Boolean(state.model.metadata?.previewCadAssets); const image = (asset || gold) && assetPreview(asset, component) && (approved || previewCad) ? `<image href="${assetPreview(asset, component)}" x="${r.x}" y="${sy(r.y, r.height)}" width="${r.width}" height="${r.height}" preserveAspectRatio="xMidYMid meet" opacity=".96" pointer-events="none"/>` : ''; const status = gold ? ' · GOLD PREVIEW' : asset && !approved ? ' · PREVIEW ONLY' : approved ? ' · CAD' : ''; const locked = component.locked ? ' · LOCKED' : ''; const issue = state.issues.some((entry) => entry.entity === component.id || entry.entity_id === component.id) && !approved; out.push(`<g data-component-id="${esc(component.id)}" tabindex="0" role="button" aria-label="${esc(component.tag)} ${esc(component.name)}"><rect x="${r.x}" y="${sy(r.y, r.height)}" width="${r.width}" height="${r.height}" fill="${esc(component.color)}" fill-opacity="${approved || gold ? '.08' : '.28'}" stroke="${issue ? '#ff6b76' : selected ? '#ffffff' : '#a6ceff'}" stroke-width="${selected ? 3 : issue ? 2.5 : 1.3}" rx="2"/>${image}<text pointer-events="none" x="${r.x + 4}" y="${sy(r.y + r.height / 2) + 4}" fill="#f0f7ff" font-size="${Math.max(6, Math.min(13, r.height / 4))}" font-weight="650">${esc(component.tag)}</text><text pointer-events="none" x="${r.x + 4}" y="${sy(r.y + 8)}" fill="#d2e2f4" font-size="${Math.max(4, Math.min(7, r.height / 8))}">${esc(component.name)}${status}${locked}</text>${selected ? `<rect x="${r.x - 5}" y="${sy(r.y, r.height) - 5}" width="${r.width + 10}" height="${r.height + 10}" fill="none" stroke="#60a5fa" stroke-dasharray="4 3"/>` : ''}</g>`); });
    out.push(`<text x="20" y="25" fill="#c6d9ef" font-size="13" font-weight="650">${esc(model.enclosure.name)} · ${esc(model.project.revision)}</text>`); svg.innerHTML = out.join('');
    $('#projectName').textContent = model.project.name; $('#canvasTitle').textContent = model.project.name; $('#projectRevision').textContent = `REV ${model.project.revision}`; $('#zoomValue').textContent = `${Math.round(state.zoom * 100)}%`; $('#toggleGrid').setAttribute('aria-pressed', String(state.grid)); $('#canvasViewport').classList.toggle('no-grid', !state.grid); $('#dropHint').classList.toggle('hidden', model.components.length > 0);
    renderInspector(); renderValidation(); renderBom(); renderRulers();
  }

  function renderRulers() {
    const model = state.model; const top = $('#rulerTop'); const left = $('#rulerLeft'); const marks = []; for (let x = 0; x <= model.enclosure.width; x += 100) marks.push(`<span style="position:absolute;left:${(x / model.enclosure.width) * 100}%;top:1px">${x}</span>`); top.innerHTML = marks.join(''); const leftMarks = []; for (let y = model.enclosure.height; y >= 0; y -= 100) leftMarks.push(`<span style="position:absolute;left:3px;top:${((model.enclosure.height - y) / model.enclosure.height) * 100}%">${y}</span>`); left.innerHTML = leftMarks.join('');
  }

  function renderInspector() {
    const component = componentById(state.selectedId); const form = $('#inspectorForm'); $('#inspectorEmpty').hidden = Boolean(component); form.hidden = !component; if (!component) { $('#selectionTitle').textContent = 'No selection'; $('#selectionTag').textContent = '—'; return; } $('#selectionTitle').textContent = component.name; $('#selectionTag').textContent = component.tag; form.elements.tag.value = component.tag; form.elements.name.value = component.name; form.elements.x.value = Math.round(component.x); form.elements.y.value = Math.round(component.y); form.elements.width.value = Math.round(component.width); form.elements.height.value = Math.round(component.height); form.elements.rotation.value = String(component.rotation); $('#selectionKind').textContent = component.kind; $('#selectionGroup').textContent = component.group; const asset = assetFor(component); const gold = goldFor(component); $('#selectionCadStatus').textContent = gold ? `GOLD: ${component.metadata?.geometryStatus || 'clean crop'}` : asset ? `CAD: ${component.metadata?.geometryStatus || 'source_verified'}` : 'CAD: unavailable'; $('#selectionMappingStatus').textContent = gold ? `Identity: ${component.metadata?.identityStatus || 'unknown'} · View: ${component.metadata?.viewStatus || 'unknown'} · Mount: ${component.metadata?.mountingType || 'unknown'} · Envelope: ${component.metadata?.physicalEnvelopeStatus || 'unknown'}` : asset ? `Mapping: ${component.metadata?.physicalMappingStatus || (assetApproved(asset) ? 'approved' : 'unknown')}` : 'Mapping: —'; $('#toggleLock').textContent = component.locked ? 'Unlock position' : 'Lock position';
  }

  function renderValidation() {
    const list = $('#validationList'); const count = $('#issueCount'); count.textContent = String(state.issues.length); count.style.color = state.issues.some((issue) => issue.severity === 'error') ? '#ff9aa0' : state.issues.length ? '#f4b740' : '#9fcaff'; if (!state.issues.length) { list.innerHTML = '<div class="all-clear"><span>✓</span><div><strong>Layout is clear</strong><small>No blocking issues</small></div></div>'; return; } list.innerHTML = state.issues.map((issue) => `<div class="issue ${issue.severity === 'warn' ? 'warn' : ''}"><span class="issue-code">${issue.code}</span><div><strong>${issue.message}</strong><small>${issue.hint}</small></div></div>`).join('');
  }

  function renderBom() {
    const groups = new Map(); state.model.components.forEach((component) => { const gold = goldFor(component); const key = gold ? (gold.candidate_name || gold.display_name) : (component.partNumber || component.name); const item = groups.get(key) || { tag: component.tag, part: key, qty: 0 }; item.qty += 1; groups.set(key, item); }); const rows = Array.from(groups.values()); $('#bomCount').textContent = String(state.model.components.length); $('#bomBody').innerHTML = rows.map((row) => `<tr><td>${row.tag}${row.qty > 1 ? ' +' : ''}</td><td title="${row.part}">${row.part}</td><td>${row.qty}</td></tr>`).join('');
  }

  function showToast(message, tone = 'info') { const toast = $('#toast'); toast.textContent = message; toast.dataset.tone = tone; toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 2800); }
  function select(id) { state.selectedId = id; render(); }
  function pointerDrop(event) { const point = pointerToModel(event); const goldId = event.dataTransfer?.getData('text/cnb-gold'); if (goldId) { const profile = state.goldCatalog.find((item) => item.gold_id === goldId); if (profile) addGoldComponent(profile, point); event.preventDefault(); return; } const assetId = event.dataTransfer?.getData('text/cnb-asset'); if (assetId) { const asset = state.assetCatalog.find((item) => assetKey(item) === assetId); if (asset) { const approved = assetApproved(asset); if (state.model.metadata?.knownUnitOnly && !assetKnownMm(asset)) showToast('Chỉ asset có đơn vị mm đã xác nhận mới được đưa vào scenario này', 'error'); else if (state.model.metadata?.authoritative && !approved) showToast('Chưa xác minh kích thước: không thể đưa vào authoritative layout', 'error'); else addAssetComponent(asset, approved, point); } event.preventDefault(); return; } const kind = event.dataTransfer?.getData('text/cnb-component'); if (kind) { addComponent(kind, point.x, point.y); event.preventDefault(); } }
  function nextDeviceIndex() { const used = new Set(state.model.components.map((component) => component.id)); let index = state.model.components.reduce((maximum, component) => Math.max(maximum, Number(String(component.id).match(/(\d+)$/)?.[1]) || 0), 0) + 1; while (used.has(`device-${String(index).padStart(3, '0')}`)) index += 1; return index; }
  function railSnapCandidate(component) {
    if (component.mounting !== 'DIN' || !state.model.rails.length) return null;
    const current = rect(component);
    const centerY = current.y + current.height / 2;
    return state.model.rails
      .filter((rail) => current.x < rail.x + rail.length && current.x + current.width > rail.x)
      .map((rail) => ({ rail, distance: Math.abs(centerY - (rail.y + rail.height / 2)) }))
      .sort((a, b) => a.distance - b.distance)[0] || null;
  }

  function snapToNearestRail(component) {
    const candidate = railSnapCandidate(component);
    if (!candidate || candidate.distance > 90) {
      if (component.mounting === 'DIN') component.railId = null;
      return false;
    }
    const size = rect(component);
    component.y = snap(candidate.rail.y + candidate.rail.height / 2 - size.height / 2, GRID_MM);
    component.railId = candidate.rail.id;
    return true;
  }

  function addComponent(kind, x, y) { const next = nextDeviceIndex(); const spec = catalog[kind] || catalog.breaker; const component = componentFrom(kind, next, snap(x - spec.width / 2, GRID_MM), snap(y - spec.height / 2, GRID_MM)); state.model.components.push(component); snapToNearestRail(component); state.selectedId = component.id; validate(); render(); showToast(`${spec.label} added at ${Math.round(component.x)} × ${Math.round(component.y)} mm`); }
  function autoLayout() {
    const model = state.model; const plate = model.mountingPlate; const priority = (group) => ({ Incoming: 0, Power: 1, 'Motor starter': 2, Control: 3, General: 4, Terminals: 9 }[group] ?? (/^Feeder/.test(group) ? 2 : 5)); const ordered = [...model.components].filter((component) => !component.locked && (!component.assetId || assetApproved(assetFor(component)) || model.metadata?.previewCadAssets)).sort((a, b) => priority(a.group) - priority(b.group) || a.group.localeCompare(b.group) || (b.width * b.height) - (a.width * a.height) || a.id.localeCompare(b.id));
    const verticalDucts = model.ducts.filter((duct) => duct.height > duct.width); let usableLeft = plate.x + 18; let usableRight = plate.x + plate.width - 18; const middle = plate.x + plate.width / 2; verticalDucts.forEach((duct) => { if (duct.x + duct.width / 2 < middle) usableLeft = Math.max(usableLeft, duct.x + duct.width + 14); else usableRight = Math.min(usableRight, duct.x - 14); });
    const rails = [...model.rails].sort((a, b) => b.y - a.y); const rows = rails.map((rail) => ({ rail, items: [], width: 0 })); let rowIndex = 0;
    ordered.forEach((component) => { component.rotation = 0; const width = rect(component).width; let row = rows[rowIndex]; const minGap = row.items.length ? 5 : 0; while (row && row.width + minGap + width > usableRight - usableLeft && rowIndex < rows.length - 1) { rowIndex += 1; row = rows[rowIndex]; } if (!row) return; row.items.push(component); row.width += (row.items.length > 1 ? 5 : 0) + width; });
    if (!rows.length) {
      let x = usableLeft; let y = plate.y + plate.height - 40; let rowHeight = 0;
      ordered.forEach((component) => { const size = rect(component); if (x + size.width > usableRight && x > usableLeft) { x = usableLeft; y -= rowHeight + 24; rowHeight = 0; } component.x = snap(x, 1); component.y = snap(y - size.height, 1); component.railId = null; x += size.width + 18; rowHeight = Math.max(rowHeight, size.height); });
    } else rows.forEach((row) => { if (!row.items.length) return; const free = Math.max(0, usableRight - usableLeft - row.items.reduce((sum, component) => sum + rect(component).width, 0)); const gap = row.items.length > 1 ? Math.min(18, free / (row.items.length - 1)) : 0; let x = usableLeft; row.items.forEach((component) => { const size = rect(component); component.x = snap(x, 1); component.y = snap(row.rail.y + row.rail.height / 2 - size.height / 2, 1); component.railId = row.rail.id; x += size.width + gap; }); });
    state.selectedId = null; validate(); render(); showToast(`Auto layout placed ${ordered.length} components · ${state.issues.length} issues`);
  }
  function updateSelected(name, value) { const component = componentById(state.selectedId); if (!component) return; if (['x', 'y', 'width', 'height', 'rotation'].includes(name)) component[name] = finite(value, component[name]); else component[name] = value; validate(); render(); }
  function removeSelected() { const index = state.model.components.findIndex((component) => component.id === state.selectedId); if (index < 0) return; const removed = state.model.components.splice(index, 1)[0]; state.model.connections = state.model.connections.filter((connection) => connection.from !== removed.id && connection.to !== removed.id); state.selectedId = null; validate(); render(); showToast(`${removed.tag} removed`); }
  function toggleSelectedLock() { const component = componentById(state.selectedId); if (!component) return; component.locked = !component.locked; render(); showToast(component.locked ? `${component.tag} locked` : `${component.tag} unlocked`); }
  function duplicateSelected() { const source = componentById(state.selectedId); if (!source) return; const copy = clone(source); copy.id = `device-${String(nextDeviceIndex()).padStart(3, '0')}`; copy.tag = `${source.tag}-COPY`; copy.x += 20; copy.y -= 20; copy.locked = false; state.model.components.push(copy); state.selectedId = copy.id; validate(); render(); showToast(`${source.tag} duplicated`); }
  function rotateSelected() { const component = componentById(state.selectedId); if (!component || component.locked) return; component.rotation = (Number(component.rotation) + 90) % 360; validate(); render(); showToast(`${component.tag} rotated ${component.rotation}°`); }
  function download(name, content, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function exportFormat(format) { const base = state.model.project.id || 'panel'; const blocked = state.model.components.some((component) => component.assetId && !assetApproved(assetFor(component))); if ((format === 'dxf' || format === 'svg') && blocked && state.model.metadata?.authoritative) { showToast('Export blocked: preview-only CAD asset is not approved', 'error'); return; } if ((format === 'dxf' || format === 'svg') && (state.model.metadata?.authoritative || state.model.components.some((component) => component.assetId))) { fetch('/api/export', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: state.model, format }) }).then(async (response) => { if (!response.ok) { const payload = await response.json().catch(() => ({})); showToast(`${state.model.metadata?.authoritative ? 'Authoritative' : 'Preview'} export blocked${payload.validation ? ` · ${payload.validation.errors.map((issue) => issue.code).join(', ')}` : ''}`, 'error'); return; } download(`${base}.${format}`, await response.text(), format === 'dxf' ? 'application/dxf' : 'image/svg+xml'); showToast(`${state.model.metadata?.authoritative ? 'Authoritative' : 'Preview'} ${format.toUpperCase()} exported`); }).catch(() => showToast('Export request failed', 'error')); return; } if (format === 'dxf') { const text = CnbCadExport.exportDxf(state.model); const audit = clientAuditDxf(text); download(`${base}.dxf`, text, 'application/dxf'); showToast(audit.valid ? `DXF exported · ${audit.entityCount} entities audited` : 'DXF export failed audit', audit.valid ? 'info' : 'error'); } else if (format === 'svg') { download(`${base}.svg`, CnbCadExport.exportSvg(state.model), 'image/svg+xml'); showToast('SVG preview exported'); } else { download(`${base}.canonical.json`, `${JSON.stringify(state.model, null, 2)}\n`, 'application/json'); showToast('Canonical model exported'); } }
  function screenPointForModel(modelPoint) { const svg = $('#panelSvg'); const point = svg.createSVGPoint(); point.x = modelPoint.x; point.y = state.model.enclosure.height - modelPoint.y; const screen = point.matrixTransform(svg.getScreenCTM()); return { x: screen.x, y: screen.y }; }
  function zoomAt(event, nextZoom) { const before = pointerToModel(event); state.zoom = Math.max(.1, Math.min(20, nextZoom)); render(); const after = screenPointForModel(before); state.panX += event.clientX - after.x; state.panY += event.clientY - after.y; render(); }
  function focusComponent(component) { const viewport = $('#canvasViewport').getBoundingClientRect(); const center = CnbCadExport.center(component); state.zoom = Math.max(state.zoom, Math.min(20, 3.5)); render(); const screen = screenPointForModel(center); state.panX += viewport.left + viewport.width / 2 - screen.x; state.panY += viewport.top + viewport.height / 2 - screen.y; render(); }
  function fitCanvas() { const viewport = $('#canvasViewport').getBoundingClientRect(); state.zoom = 1; state.panX = 0; state.panY = 0; render(); const svgBox = $('#panelSvg').getBoundingClientRect(); const margin = 28; const fitZoom = Math.max(.1, Math.min(20, Math.min((viewport.width - margin) / svgBox.width, (viewport.height - margin) / svgBox.height))); state.zoom = fitZoom; render(); const target = { x: viewport.left + viewport.width / 2, y: viewport.top + viewport.height / 2 }; const screen = screenPointForModel({ x: state.model.enclosure.width / 2, y: state.model.enclosure.height / 2 }); state.panX += target.x - screen.x; state.panY += target.y - screen.y; render(); }
  function loadModel(raw, label) { const adapted = CnbEirAdapter.adapt(raw); state.model = CnbCadExport.normalizeModel(adapted); state.selectedId = null; $('#assetFilter').value = state.model.metadata?.knownUnitOnly ? 'units' : 'all'; assignDemoAssets(); validate(); fitCanvas(); showToast(`${label || state.model.project.name} loaded`); }

  function renderAssetLibrary() {
    const list = $('#assetList'); if (!list) return;
    const query = $('#librarySearch').value.toLowerCase();
    const filter = $('#assetFilter')?.value || 'all';
    const records = state.assetCatalog.filter((asset) => { const searchable = `${asset.relative_path} ${asset.candidate_description || ''} ${asset.product_family || ''}`.toLowerCase(); if (!searchable.includes(query)) return false; if (filter === 'units') return assetKnownMm(asset); if (filter === 'ready') return assetApproved(asset); if (filter === 'preview') return !assetApproved(asset); if (filter === 'review') return asset.review_state !== 'approved-footprint'; return true; });
    list.innerHTML = records.map((asset) => { const source = asset.source_bbox || asset.bbox; const dimensions = asset.unit_confidence === 'confirmed-from-dxf' || asset.unit_confidence === 'confirmed-by-review' ? `${Number(asset.physical_width_mm).toFixed(2)} × ${Number(asset.physical_height_mm).toFixed(2)} mm` : `${Number(source?.width || 0).toFixed(2)} × ${Number(source?.height || 0).toFixed(2)} source units`; const badge = asset.review_state === 'approved-footprint' ? 'SẴN SÀNG BỐ TRÍ' : asset.drawing_sheet ? 'DRAWING SHEET' : asset.unit_confidence === 'unknown' ? 'CHỈ XEM TRƯỚC · UNIT UNKNOWN' : asset.candidate_view === null ? 'CẦN XÁC MINH VIEW' : asset.review_state; return `<button class="asset-card" draggable="true" type="button" data-asset-id="${assetKey(asset)}" title="${asset.relative_path}"><img loading="lazy" src="${assetPreview(asset)}" alt=""><span><strong>${asset.candidate_description || asset.relative_path}</strong><small>${asset.product_family || 'Unknown family'} · ${asset.candidate_view || 'unknown view'}<br>${dimensions} · ${asset.parse_status}</small><span class="asset-badge ${asset.review_state === 'approved-footprint' ? 'approved' : ''}">${badge}</span></span></button>`; }).join('');
    $$('.asset-card', list).forEach((item) => item.addEventListener('dragstart', (event) => { event.dataTransfer.setData('text/cnb-asset', item.dataset.assetId); event.dataTransfer.effectAllowed = 'copy'; }));
    $$('.asset-card', list).forEach((item) => item.addEventListener('click', () => { state.selectedAssetId = item.dataset.assetId; renderAssetDetail(); }));
    renderAssetDetail();
  }

  function renderProductLibrary() {
    const list = $('#productList'); if (!list) return;
    const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    list.innerHTML = state.productCatalog.map((product) => `<article class="asset-card" data-product-id="${esc(product.id)}"><div class="asset-thumb"><div class="product-glyph">${esc((product.type_designation || '').slice(-4))}</div></div><div class="asset-card-copy"><strong>${esc(product.type_designation)}</strong><span>${esc(product.manufacturer_order_code)} · ${esc(product.description)}</span><small>${esc(product.verification_status)} · ${product.footprint.width_mm} × ${product.footprint.height_mm} × ${product.footprint.depth_mm} mm</small></div></article>`).join('') || '<div class="empty-state"><p>No R3 products loaded</p></div>';
    $$('.asset-card', list).forEach((item) => item.addEventListener('click', () => {
      const product = state.productCatalog.find((candidate) => candidate.id === item.dataset.productId); if (!product) return;
      const detail = $('#assetDetail'); detail.hidden = false; const artifact = product.source_artifacts?.[0] || {}; const clearance = product.provenance?.clearance_mm || {}; const access = product.provenance?.service_access_direction || {}; const defaultNote = clearance.status === 'unknown' ? '<div><dt>Layout default</dt><dd>5 mm · ENGINEERING DEFAULT · CNB-CLEARANCE-DEFAULT-V1</dd></div>' : ''; detail.innerHTML = `<h3>${esc(product.type_designation)}</h3><dl><div><dt>Manufacturer</dt><dd>${esc(product.manufacturer)}</dd></div><div><dt>Series</dt><dd>${esc(product.series)}</dd></div><div><dt>Type designation</dt><dd>${esc(product.type_designation)}</dd></div><div><dt>Manufacturer order code</dt><dd class="mono">${esc(product.manufacturer_order_code)}</dd></div><div><dt>Rated current</dt><dd>${esc(product.rated_current_a)} A · characteristic ${esc(product.characteristic)}</dd></div><div><dt>Description</dt><dd>${esc(product.description)}</dd></div><div><dt>Envelope</dt><dd>${product.footprint.width_mm} × ${product.footprint.height_mm} × ${product.footprint.depth_mm} mm</dd></div><div><dt>Mounting</dt><dd>${esc(product.footprint.mounting)} · rail ${product.footprint.rail_width_mm} mm · vendor position ${esc(product.footprint.vendor_mounting_position)}</dd></div><div><dt>Verification</dt><dd>${esc(product.verification_status)}</dd></div><div><dt>Source artifact</dt><dd>${esc(artifact.id || 'UNKNOWN')} · ${esc(artifact.retrieval_status || 'UNKNOWN')}</dd></div><div><dt>Document SHA256</dt><dd class="mono">${esc(artifact.sha256 || 'UNKNOWN')}</dd></div><div><dt>Clearance source</dt><dd>${esc(clearance.status || 'UNKNOWN')} · ${esc(clearance.notes || 'No product-specific value')}</dd></div>${defaultNote}<div><dt>Service access</dt><dd>${esc(access.status || 'UNKNOWN')}</dd></div><div><dt>Known unknowns</dt><dd>${esc((product.known_unknowns || []).join('; ') || 'none')}</dd></div></dl><span class="asset-badge approved">R3.1b ${esc(product.verification_status.toUpperCase())}</span>`;
    }));
  }

  function renderAssetDetail() {
    const detail = $('#assetDetail'); const asset = state.assetCatalog.find((candidate) => assetKey(candidate) === state.selectedAssetId); if (!detail || !asset) { if (detail) detail.hidden = true; return; }
    const source = asset.source_bbox || asset.bbox || {}; const approved = assetApproved(asset); detail.hidden = false; detail.innerHTML = `<h3>${asset.candidate_description || asset.relative_path}</h3><img src="${assetPreview(asset)}" alt="CAD preview"><div class="status-stack"><span class="asset-badge approved">Geometry: SOURCE VERIFIED</span><span class="asset-badge">Identity: ${asset.product_identity_id ? 'DOCUMENT VERIFIED' : 'CANDIDATE · NEEDS REVIEW'}</span><span class="asset-badge">Physical mapping: ${approved ? 'APPROVED' : 'UNKNOWN'}</span></div><dl><div><dt>Manufacturer</dt><dd>${asset.manufacturer || 'unknown'}</dd></div><div><dt>Family</dt><dd>${asset.product_family || 'unknown'}</dd></div><div><dt>View</dt><dd>${asset.candidate_view || 'unknown'}</dd></div><div><dt>Source</dt><dd>${asset.source_group}</dd></div><div><dt>Source hash</dt><dd class="mono">${asset.sha256 || asset.content_sha256 || 'unknown'}</dd></div><div><dt>Raw bounds</dt><dd>${Number(source.width || 0).toFixed(2)} × ${Number(source.height || 0).toFixed(2)} ${asset.source_units || 'source units'}</dd></div><div><dt>Physical mm</dt><dd>${asset.physical_width_mm ? `${Number(asset.physical_width_mm).toFixed(2)} × ${Number(asset.physical_height_mm).toFixed(2)} mm` : 'not confirmed'}</dd></div><div><dt>Depth mm</dt><dd>${asset.physical_depth_mm || 'not confirmed'}</dd></div><div><dt>Product candidate</dt><dd>${asset.product_id || 'unknown'}</dd></div><div><dt>Review</dt><dd>${asset.review_state || 'needs-review'}</dd></div></dl><span class="asset-badge ${approved ? 'approved' : ''}">${approved ? 'SẴN SÀNG BỐ TRÍ' : 'CHỈ XEM TRƯỚC · KHÔNG AUTHORITATIVE'}</span>${asset.drawing_sheet ? '<span class="asset-badge">DRAWING SHEET · MANUAL EXTRACTION</span>' : ''}<form class="review-form" id="assetReviewForm"><div class="form-grid"><label>Unit<select name="unit"><option value="">Unknown</option><option value="mm">mm</option></select></label><label>View<select name="view"><option value="">Unknown</option><option value="front">front</option><option value="side">side</option><option value="top">top</option></select></label></div><div class="form-grid"><label>Physical width mm<input name="width" type="number" min="0.01" step="0.0001"></label><label>Physical height mm<input name="height" type="number" min="0.01" step="0.0001"></label></div><button class="button primary" type="submit">Approve footprint</button><button class="button subtle" id="addPreviewAsset" type="button">Đặt preview vào demo</button></form>`;
    const form = $('#assetReviewForm'); form.elements.unit.value = asset.unit_confidence === 'confirmed-from-dxf' || asset.unit_confidence === 'confirmed-by-review' ? 'mm' : ''; form.elements.view.value = asset.candidate_view || ''; form.elements.width.value = asset.physical_width_mm || ''; form.elements.height.value = asset.physical_height_mm || ''; $('#addPreviewAsset').textContent = approved ? 'Add approved footprint' : 'Add preview-only component';
    form.addEventListener('submit', async (event) => { event.preventDefault(); const unit = form.elements.unit.value; const width = finite(form.elements.width.value, 0); const height = finite(form.elements.height.value, 0); const view = form.elements.view.value; if (asset.drawing_sheet) { showToast('Drawing sheet requires manual extraction before approval', 'error'); return; } if (!unit || unit !== 'mm' || width <= 0 || height <= 0 || !view) { showToast('Approval requires mm unit, physical bounds and a view', 'error'); return; } const response = await fetch('/api/catalog/reviews', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source_asset_id: assetKey(asset), representation_id: asset.representation_id, confirmed_view: view, physical_width_mm: width, physical_height_mm: height }) }); const payload = await response.json(); if (!response.ok) { showToast(`Approval failed: ${payload.error || response.status}`, 'error'); return; } const updated = payload.catalog.records.find((item) => assetKey(item) === assetKey(asset)); if (updated) { const index = state.assetCatalog.findIndex((item) => assetKey(item) === assetKey(asset)); state.assetCatalog[index] = updated; } renderAssetLibrary(); renderAssetDetail(); showToast('Review-approved test footprint persisted'); });
    $('#addPreviewAsset').addEventListener('click', () => { if (state.model.metadata?.knownUnitOnly && !assetKnownMm(asset)) { showToast('Chỉ asset có đơn vị mm đã xác nhận mới được đưa vào scenario này', 'error'); return; } addAssetComponent(asset, assetApproved(asset)); });
  }

  function addAssetComponent(asset, approved, dropPoint = null) { const next = nextDeviceIndex(); const source = asset.source_bbox || asset.bbox || {}; const component = componentFrom('plc', next, state.model.enclosure.width / 2, state.model.enclosure.height / 2); component.name = asset.candidate_description || 'Imported CAD asset'; component.partNumber = `CAD-${assetKey(asset)}`; component.assetId = assetKey(asset); component.source_asset_id = assetKey(asset); component.footprintRef = assetApproved(asset) ? asset.physical_footprint_id : null; component.mounting = approved ? 'DIN' : 'Plate'; component.metadata = { geometryStatus: 'source_verified', identityStatus: asset.product_identity_id ? 'document_verified' : 'candidate_needs_review', physicalMappingStatus: approved ? 'document_verified' : 'unknown', sourceAssetId: assetKey(asset), sourceHash: asset.sha256 || asset.content_sha256 || null, placementCapable: Boolean(approved) }; if (approved && assetApproved(asset)) { component.width = asset.physical_width_mm; component.height = asset.physical_height_mm; } else { component.width = Math.max(20, Number(source.width) || 75); component.height = Math.max(20, Number(source.height) || 100); } const point = dropPoint || { x: state.model.enclosure.width / 2, y: state.model.enclosure.height / 2 }; component.x = snap(point.x - component.width / 2, GRID_MM); component.y = snap(point.y - component.height / 2, GRID_MM); state.model.components.push(component); if (approved) snapToNearestRail(component); state.selectedId = component.id; validate(); render(); showToast(approved ? 'Đã thêm footprint đã duyệt' : 'Đã thêm preview CAD · chưa xác minh kích thước'); }

  function addGoldComponent(profile, dropPoint = null) { const next = nextDeviceIndex(); const bounds = profile.derived_bounds || {}; const component = componentFrom('plc', next, state.model.enclosure.width / 2, state.model.enclosure.height / 2); component.id = `gold-device-${String(next).padStart(3, '0')}`; component.tag = `-G${next}`; component.name = profile.display_name || profile.candidate_name || 'Gold CAD device'; component.partNumber = profile.candidate_name || profile.display_name || 'Gold CAD candidate'; component.assetId = profile.gold_id; component.goldId = profile.gold_id; component.source_asset_id = profile.source_asset_id; component.width = Math.max(1, Number(bounds.width) || 75); component.height = Math.max(1, Number(bounds.height) || 100); component.mounting = profile.mounting_type || 'unknown'; component.group = profile.manufacturer || 'Siemens'; component.color = '#14b8a6'; component.metadata = { goldProfileId: profile.gold_id, displayName: profile.display_name, geometryStatus: profile.geometry_status, identityStatus: profile.identity_status, physicalMappingStatus: profile.physical_mapping_status, physicalEnvelopeStatus: profile.physical_envelope_status, viewStatus: profile.view_status, mountingType: profile.mounting_type, sourceUnits: profile.source_units, sourceAssetId: profile.source_asset_id, sourceHash: profile.source_sha256, placementCapable: Boolean(profile.placement_capable) }; const point = dropPoint || { x: state.model.enclosure.width / 2, y: state.model.enclosure.height / 2 }; component.x = snap(point.x - component.width / 2, GRID_MM); component.y = snap(point.y - component.height / 2, GRID_MM); state.model.components.push(component); state.selectedId = component.id; validate(); render(); showToast(`${component.name} added · gold preview only`); }

  async function loadAssetCatalog() { try { const response = await fetch('/api/catalog'); if (!response.ok) throw new Error(`HTTP ${response.status}`); const manifest = await response.json(); state.assetCatalog = manifest.records || []; assignDemoAssets(); renderAssetLibrary(); render(); $('#libraryCount').textContent = String(state.assetCatalog.length); } catch (error) { showToast(`CAD catalog unavailable: ${error.message}`, 'error'); } }

  async function loadGoldCatalog() { try { const response = await fetch('/api/catalog/gold'); if (!response.ok) throw new Error(`HTTP ${response.status}`); const manifest = await response.json(); state.goldCatalog = manifest.profiles || []; renderGoldLibrary(); render(); } catch (error) { showToast(`Gold device catalog unavailable: ${error.message}`, 'error'); } }

  function wireEvents() {
    $('#loadScenario').addEventListener('click', async () => { const key = $('#scenarioSelect').value; if (key === 'r2' || key === 'r2b' || key === 'r3') { const response = await fetch(`/api/benchmark/${key}`); if (!response.ok) { showToast(`${key.toUpperCase()} benchmark unavailable; run the benchmark builder`, 'error'); return; } loadModel(await response.json(), $('#scenarioSelect option:checked').textContent); } else loadModel(scenarios[key](), $('#scenarioSelect option:checked').textContent); });
    $('#jsonInput').addEventListener('change', async (event) => { const file = event.target.files?.[0]; if (!file) return; try { loadModel(JSON.parse(await file.text()), file.name); } catch (error) { showToast(`Could not read JSON: ${error.message}`, 'error'); } event.target.value = ''; });
    $('#autoLayout').addEventListener('click', autoLayout); $('#zoomIn').addEventListener('click', () => zoomAt({ clientX: $('#canvasViewport').getBoundingClientRect().left + $('#canvasViewport').clientWidth / 2, clientY: $('#canvasViewport').getBoundingClientRect().top + $('#canvasViewport').clientHeight / 2 }, state.zoom * 1.25)); $('#zoomOut').addEventListener('click', () => zoomAt({ clientX: $('#canvasViewport').getBoundingClientRect().left + $('#canvasViewport').clientWidth / 2, clientY: $('#canvasViewport').getBoundingClientRect().top + $('#canvasViewport').clientHeight / 2 }, state.zoom / 1.25)); $('#fitCanvas').addEventListener('click', fitCanvas); $('#toggleGrid').addEventListener('click', () => { state.grid = !state.grid; render(); });
    $('#librarySearch').addEventListener('input', (event) => { const query = event.target.value.toLowerCase(); $$('.library-item').forEach((item) => { item.hidden = !item.textContent.toLowerCase().includes(query); }); renderAssetLibrary(); renderGoldLibrary(); }); $('#assetFilter').addEventListener('change', renderAssetLibrary);
    const setLibraryMode = (mode) => { state.libraryMode = mode; const modes = { components: ['componentTab', 'libraryList'], assets: ['assetTab', 'assetList'], gold: ['goldTab', 'goldList'], products: ['productTab', 'productList'] }; Object.entries(modes).forEach(([key, [tab, list]]) => { const active = key === mode; $(`#${tab}`).classList.toggle('active', active); $(`#${tab}`).setAttribute('aria-selected', String(active)); $(`#${list}`).hidden = !active; }); if (mode === 'assets') renderAssetLibrary(); if (mode === 'gold') renderGoldLibrary(); if (mode === 'products') renderProductLibrary(); };
    $('#componentTab').addEventListener('click', () => setLibraryMode('components'));
    $('#assetTab').addEventListener('click', () => setLibraryMode('assets'));
    $('#goldTab').addEventListener('click', () => setLibraryMode('gold'));
    $('#productTab').addEventListener('click', () => setLibraryMode('products'));
    $('#exportMenu').addEventListener('click', () => { const menu = $('#exportMenuItems'); menu.hidden = !menu.hidden; $('#exportMenu').setAttribute('aria-expanded', String(!menu.hidden)); }); $$('#exportMenuItems button').forEach((button) => button.addEventListener('click', () => { exportFormat(button.dataset.export); $('#exportMenuItems').hidden = true; $('#exportMenu').setAttribute('aria-expanded', 'false'); }));
    $('#inspectorForm').addEventListener('change', (event) => { if (event.target.name) updateSelected(event.target.name, event.target.value); }); $('#deleteComponent').addEventListener('click', removeSelected); $('#toggleLock').addEventListener('click', toggleSelectedLock); $('#duplicateComponent').addEventListener('click', duplicateSelected); $('#rotateComponent').addEventListener('click', rotateSelected);
    const svg = $('#panelSvg'); const viewport = $('#canvasViewport');
    viewport.addEventListener('wheel', (event) => { event.preventDefault(); zoomAt(event, state.zoom * Math.exp(-event.deltaY * 0.0015)); }, { passive: false });
    viewport.addEventListener('contextmenu', (event) => event.preventDefault());
    svg.addEventListener('dragover', (event) => { if (event.dataTransfer.types.includes('text/cnb-component') || event.dataTransfer.types.includes('text/cnb-asset') || event.dataTransfer.types.includes('text/cnb-gold')) event.preventDefault(); });
    svg.addEventListener('drop', pointerDrop);
    viewport.addEventListener('pointerdown', (event) => {
      if (event.button === 1 || event.button === 2 || (event.button === 0 && event.altKey)) {
        state.pan = { x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY };
        viewport.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
      const target = event.target.closest?.('[data-component-id]');
      if (!target) { state.selectedId = null; render(); return; }
      const id = target.dataset.componentId; const component = componentById(id); if (!component) return;
      if (component.locked) { state.selectedId = id; render(); showToast(`${component.tag} is locked`, 'info'); return; }
      const point = pointerToModel(event); state.selectedId = id; state.drag = { id, dx: point.x - component.x, dy: point.y - component.y }; viewport.setPointerCapture(event.pointerId); render();
    });
    viewport.addEventListener('pointermove', (event) => {
      if (state.pan) { state.panX = state.pan.panX + (event.clientX - state.pan.x); state.panY = state.pan.panY + (event.clientY - state.pan.y); render(); return; }
      if (!state.drag) { const point = pointerToModel(event); $('#cursorReadout').textContent = `X ${Math.round(point.x)} · Y ${Math.round(point.y)}`; return; }
      const component = componentById(state.drag.id); if (!component) return; const point = pointerToModel(event); component.x = snap(point.x - state.drag.dx, GRID_MM); component.y = snap(point.y - state.drag.dy, GRID_MM); validate(); render();
    });
    viewport.addEventListener('pointerup', (event) => {
      if (state.pan) { state.pan = null; viewport.releasePointerCapture?.(event.pointerId); return; }
      if (state.drag) { const component = componentById(state.drag.id); if (component) snapToNearestRail(component); state.drag = null; viewport.releasePointerCapture?.(event.pointerId); validate(); render(); }
    });
    viewport.addEventListener('pointercancel', () => { state.drag = null; state.pan = null; render(); });
    svg.addEventListener('dblclick', (event) => { const target = event.target.closest?.('[data-component-id]'); if (!target) return; const component = componentById(target.dataset.componentId); if (component) { state.selectedId = component.id; focusComponent(component); } });
    svg.addEventListener('keydown', (event) => { if (!state.selectedId) return; const component = componentById(state.selectedId); if (!component) return; const delta = event.shiftKey ? 10 : 1; if (event.key === 'ArrowLeft') component.x -= delta; else if (event.key === 'ArrowRight') component.x += delta; else if (event.key === 'ArrowUp') component.y += delta; else if (event.key === 'ArrowDown') component.y -= delta; else if (event.key === 'Delete') return removeSelected(); else return; event.preventDefault(); validate(); render(); });
    document.addEventListener('click', (event) => { if (!event.target.closest('.export-menu')) { $('#exportMenuItems').hidden = true; $('#exportMenu').setAttribute('aria-expanded', 'false'); } });
    $$('.library-item').forEach((item) => { item.addEventListener('dragstart', (event) => { event.dataTransfer.setData('text/cnb-component', item.dataset.kind); event.dataTransfer.effectAllowed = 'copy'; }); item.addEventListener('click', () => addComponent(item.dataset.kind, state.model.enclosure.width / 2, state.model.enclosure.height / 2)); });
    document.addEventListener('keydown', (event) => { if (event.key.toLowerCase() === 'f' && !/input|select|textarea/i.test(event.target.tagName)) { event.preventDefault(); fitCanvas(); } });
  }

  function renderLibrary() { const list = $('#libraryList'); list.innerHTML = library.map((item) => `<button class="library-item" draggable="true" data-kind="${item.kind}" type="button"><span class="library-glyph">${item.short}</span><span><strong>${item.label}</strong><small>${item.width} × ${item.height} mm · ${item.mounting}</small></span></button>`).join(''); $('#libraryCount').textContent = String(library.length); }

  function renderGoldLibrary() { const list = $('#goldList'); if (!list) return; const query = ($('#librarySearch')?.value || '').toLowerCase(); const records = state.goldCatalog.filter((profile) => `${profile.display_name} ${profile.candidate_name} ${profile.manufacturer} ${profile.view_status} ${profile.mounting_type}`.toLowerCase().includes(query)); const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); list.innerHTML = records.map((profile) => `<button class="asset-card gold-card" draggable="true" type="button" data-gold-id="${esc(profile.gold_id)}"><img loading="lazy" src="/api/catalog/gold-preview/${esc(profile.gold_id)}" alt=""><span><strong>${esc(profile.display_name)}</strong><small>${esc(profile.manufacturer)} · ${esc(profile.candidate_name)}<br>${Number(profile.derived_bounds?.width || 0).toFixed(1)} × ${Number(profile.derived_bounds?.height || 0).toFixed(1)} mm · ${esc(profile.view_status)}</small><span class="asset-badge">GOLD PREVIEW · NOT PLACEMENT-CAPABLE</span></span></button>`).join('') || '<div class="empty-state"><p>No gold devices loaded</p></div>'; $$('.gold-card', list).forEach((item) => { item.addEventListener('dragstart', (event) => { event.dataTransfer.setData('text/cnb-gold', item.dataset.goldId); event.dataTransfer.effectAllowed = 'copy'; }); item.addEventListener('click', () => { state.selectedGoldId = item.dataset.goldId; renderGoldDetail(); }); }); renderGoldDetail(); $('#libraryCount').textContent = String(records.length); }

  function renderGoldDetail() { const detail = $('#assetDetail'); const profile = state.goldCatalog.find((item) => item.gold_id === state.selectedGoldId); if (!detail) return; if (!profile) { detail.hidden = true; return; } const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); detail.hidden = false; detail.innerHTML = `<h3>${esc(profile.display_name)}</h3><img src="/api/catalog/gold-preview/${esc(profile.gold_id)}" alt="Gold CAD preview"><div class="status-stack"><span class="asset-badge approved">Geometry: ${esc(profile.geometry_status)}</span><span class="asset-badge">Identity: ${esc(profile.identity_status)}</span><span class="asset-badge">Physical envelope: ${esc(profile.physical_envelope_status)}</span><span class="asset-badge">Placement: NOT CAPABLE</span></div><dl><div><dt>Manufacturer</dt><dd>${esc(profile.manufacturer)}</dd></div><div><dt>Candidate</dt><dd>${esc(profile.candidate_name)}</dd></div><div><dt>View</dt><dd>${esc(profile.view_status)}</dd></div><div><dt>Mounting</dt><dd>${esc(profile.mounting_type)}</dd></div><div><dt>Envelope</dt><dd>${Number(profile.derived_bounds?.width || 0).toFixed(2)} × ${Number(profile.derived_bounds?.height || 0).toFixed(2)} mm</dd></div><div><dt>Source</dt><dd>${esc(profile.source_relative_path)}</dd></div><div><dt>Source SHA256</dt><dd class="mono">${esc(profile.source_sha256)}</dd></div></dl><p class="gold-note">${esc(profile.notes)}</p>`; }

  renderLibrary(); wireEvents(); validate(); fitCanvas(); loadAssetCatalog(); loadGoldCatalog(); fetch('/api/r3/products').then((response) => response.ok ? response.json() : null).then((payload) => { state.productCatalog = payload?.products || []; renderProductLibrary(); }).catch(() => {}); window.CNB_APP = { state, loadModel, autoLayout, validate, exportFormat, scenarios, zoomAt, fitCanvas, pointerToModel, render, renderGoldLibrary };
}());
