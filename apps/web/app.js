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
    return { id: `device-${String(index).padStart(3, '0')}`, tag: kind === 'terminal' ? `-X${index}` : `-${spec.short === 'M' ? 'QF' : spec.short}${index}`, name: spec.label, kind: spec.kind, group: spec.group, width: spec.width, height: spec.height, depth: 50, x, y, rotation: 0, railId: null, terminals: [{ id: '1' }, { id: '2' }], mounting: spec.mounting, color: spec.color, partNumber: `CNB-${kind.toUpperCase()}-${String(index).padStart(3, '0')}` };
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

  const scenarios = { starter: starterScenario, mcc: mccScenario, plc: plcScenario };
  const GRID_MM = 5;
  const state = { model: mccScenario(), selectedId: null, selectedAssetId: null, zoom: 1, panX: 0, panY: 0, grid: true, issues: [], drag: null, pan: null, assetCatalog: [], libraryMode: 'components' };

  function componentById(id) { return state.model.components.find((component) => component.id === id); }
  function assetKey(asset) { return asset ? (asset.source_asset_id || asset.id) : ''; }
  function assetFor(component) { return state.assetCatalog.find((asset) => assetKey(asset) === component.assetId) || null; }
  function assetApproved(asset) { return Boolean(asset && asset.review_state === 'approved-footprint' && asset.physical_footprint_id && asset.unit_confidence && asset.physical_width_mm > 0 && asset.physical_height_mm > 0); }
  function assetPreview(asset) { return asset ? `/api/catalog/preview/${assetKey(asset)}` : ''; }
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
      const left = authoritativeComponents[a]; const right = authoritativeComponents[b]; if (pointInside(rect(left), rect(right))) issues.push({ code: 'E002', severity: 'error', entity: left.id, message: `${left.tag} overlaps ${right.tag}`, hint: 'Separate footprints and rerun layout.' });
    }
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
    model.components.forEach((component) => { const r = rect(component); const selected = component.id === state.selectedId; const asset = assetFor(component); const approved = assetApproved(asset); const previewCad = Boolean(state.model.metadata?.previewCadAssets); const image = asset && assetPreview(asset) && (approved || previewCad) ? `<image href="${assetPreview(asset)}" x="${r.x}" y="${sy(r.y, r.height)}" width="${r.width}" height="${r.height}" preserveAspectRatio="none" opacity=".96" pointer-events="none"/>` : ''; const status = asset && !approved ? ' · PREVIEW ONLY' : approved ? ' · CAD' : ''; out.push(`<g data-component-id="${esc(component.id)}" tabindex="0" role="button" aria-label="${esc(component.tag)} ${esc(component.name)}"><rect x="${r.x}" y="${sy(r.y, r.height)}" width="${r.width}" height="${r.height}" fill="${esc(component.color)}" fill-opacity="${approved ? '.08' : '.86'}" stroke="${selected ? '#ffffff' : '#a6ceff'}" stroke-width="${selected ? 3 : 1.3}" rx="2"/>${image}<text pointer-events="none" x="${r.x + 4}" y="${sy(r.y + r.height / 2) + 4}" fill="#f0f7ff" font-size="${Math.max(6, Math.min(13, r.height / 4))}" font-weight="650">${esc(component.tag)}</text><text pointer-events="none" x="${r.x + 4}" y="${sy(r.y + 8)}" fill="#d2e2f4" font-size="${Math.max(4, Math.min(7, r.height / 8))}">${esc(component.name)}${status}</text>${selected ? `<rect x="${r.x - 5}" y="${sy(r.y, r.height) - 5}" width="${r.width + 10}" height="${r.height + 10}" fill="none" stroke="#60a5fa" stroke-dasharray="4 3"/>` : ''}</g>`); });
    out.push(`<text x="20" y="25" fill="#c6d9ef" font-size="13" font-weight="650">${esc(model.enclosure.name)} · ${esc(model.project.revision)}</text>`); svg.innerHTML = out.join('');
    $('#projectName').textContent = model.project.name; $('#canvasTitle').textContent = model.project.name; $('#projectRevision').textContent = `REV ${model.project.revision}`; $('#zoomValue').textContent = `${Math.round(state.zoom * 100)}%`; $('#toggleGrid').setAttribute('aria-pressed', String(state.grid)); $('#canvasViewport').classList.toggle('no-grid', !state.grid); $('#dropHint').classList.toggle('hidden', model.components.length > 0);
    renderInspector(); renderValidation(); renderBom(); renderRulers();
  }

  function renderRulers() {
    const model = state.model; const top = $('#rulerTop'); const left = $('#rulerLeft'); const marks = []; for (let x = 0; x <= model.enclosure.width; x += 100) marks.push(`<span style="position:absolute;left:${(x / model.enclosure.width) * 100}%;top:1px">${x}</span>`); top.innerHTML = marks.join(''); const leftMarks = []; for (let y = model.enclosure.height; y >= 0; y -= 100) leftMarks.push(`<span style="position:absolute;left:3px;top:${((model.enclosure.height - y) / model.enclosure.height) * 100}%">${y}</span>`); left.innerHTML = leftMarks.join('');
  }

  function renderInspector() {
    const component = componentById(state.selectedId); const form = $('#inspectorForm'); $('#inspectorEmpty').hidden = Boolean(component); form.hidden = !component; if (!component) { $('#selectionTitle').textContent = 'No selection'; $('#selectionTag').textContent = '—'; return; } $('#selectionTitle').textContent = component.name; $('#selectionTag').textContent = component.tag; form.elements.tag.value = component.tag; form.elements.name.value = component.name; form.elements.x.value = Math.round(component.x); form.elements.y.value = Math.round(component.y); form.elements.width.value = Math.round(component.width); form.elements.height.value = Math.round(component.height); form.elements.rotation.value = String(component.rotation); $('#selectionKind').textContent = component.kind; $('#selectionGroup').textContent = component.group;
  }

  function renderValidation() {
    const list = $('#validationList'); const count = $('#issueCount'); count.textContent = String(state.issues.length); count.style.color = state.issues.some((issue) => issue.severity === 'error') ? '#ff9aa0' : state.issues.length ? '#f4b740' : '#9fcaff'; if (!state.issues.length) { list.innerHTML = '<div class="all-clear"><span>✓</span><div><strong>Layout is clear</strong><small>No blocking issues</small></div></div>'; return; } list.innerHTML = state.issues.map((issue) => `<div class="issue ${issue.severity === 'warn' ? 'warn' : ''}"><span class="issue-code">${issue.code}</span><div><strong>${issue.message}</strong><small>${issue.hint}</small></div></div>`).join('');
  }

  function renderBom() {
    const groups = new Map(); state.model.components.forEach((component) => { const key = component.partNumber || component.name; const item = groups.get(key) || { tag: component.tag, part: key, qty: 0 }; item.qty += 1; groups.set(key, item); }); const rows = Array.from(groups.values()); $('#bomCount').textContent = String(state.model.components.length); $('#bomBody').innerHTML = rows.map((row) => `<tr><td>${row.tag}${row.qty > 1 ? ' +' : ''}</td><td title="${row.part}">${row.part}</td><td>${row.qty}</td></tr>`).join('');
  }

  function showToast(message, tone = 'info') { const toast = $('#toast'); toast.textContent = message; toast.dataset.tone = tone; toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 2800); }
  function select(id) { state.selectedId = id; render(); }
  function pointerDrop(event) { const point = pointerToModel(event); const kind = event.dataTransfer?.getData('text/cnb-component'); if (kind) { addComponent(kind, point.x, point.y); event.preventDefault(); } }
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
    const model = state.model; const plate = model.mountingPlate; const priority = (group) => ({ Incoming: 0, Power: 1, 'Motor starter': 2, Control: 3, General: 4, Terminals: 9 }[group] ?? (/^Feeder/.test(group) ? 2 : 5)); const ordered = [...model.components].filter((component) => !component.assetId || assetApproved(assetFor(component)) || model.metadata?.previewCadAssets).sort((a, b) => priority(a.group) - priority(b.group) || a.group.localeCompare(b.group) || (b.width * b.height) - (a.width * a.height) || a.id.localeCompare(b.id));
    const verticalDucts = model.ducts.filter((duct) => duct.height > duct.width); let usableLeft = plate.x + 18; let usableRight = plate.x + plate.width - 18; const middle = plate.x + plate.width / 2; verticalDucts.forEach((duct) => { if (duct.x + duct.width / 2 < middle) usableLeft = Math.max(usableLeft, duct.x + duct.width + 14); else usableRight = Math.min(usableRight, duct.x - 14); });
    const rails = [...model.rails].sort((a, b) => b.y - a.y); const rows = rails.map((rail) => ({ rail, items: [], width: 0 })); let rowIndex = 0;
    ordered.forEach((component) => { component.rotation = 0; const width = rect(component).width; let row = rows[rowIndex]; const minGap = row.items.length ? 5 : 0; while (row && row.width + minGap + width > usableRight - usableLeft && rowIndex < rows.length - 1) { rowIndex += 1; row = rows[rowIndex]; } if (!row) return; row.items.push(component); row.width += (row.items.length > 1 ? 5 : 0) + width; });
    rows.forEach((row) => { if (!row.items.length) return; const free = Math.max(0, usableRight - usableLeft - row.items.reduce((sum, component) => sum + rect(component).width, 0)); const gap = row.items.length > 1 ? Math.min(18, free / (row.items.length - 1)) : 0; let x = usableLeft; row.items.forEach((component) => { const size = rect(component); component.x = snap(x, 1); component.y = snap(row.rail.y + row.rail.height / 2 - size.height / 2, 1); component.railId = row.rail.id; x += size.width + gap; }); });
    state.selectedId = null; validate(); render(); showToast(`Auto layout placed ${ordered.length} components · ${state.issues.length} issues`);
  }
  function updateSelected(name, value) { const component = componentById(state.selectedId); if (!component) return; if (['x', 'y', 'width', 'height', 'rotation'].includes(name)) component[name] = finite(value, component[name]); else component[name] = value; validate(); render(); }
  function removeSelected() { const index = state.model.components.findIndex((component) => component.id === state.selectedId); if (index < 0) return; const removed = state.model.components.splice(index, 1)[0]; state.model.connections = state.model.connections.filter((connection) => connection.from !== removed.id && connection.to !== removed.id); state.selectedId = null; validate(); render(); showToast(`${removed.tag} removed`); }
  function download(name, content, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function exportFormat(format) { const base = state.model.project.id || 'panel'; const blocked = state.model.components.some((component) => component.assetId && !assetApproved(assetFor(component))); if ((format === 'dxf' || format === 'svg') && blocked) { showToast('Export blocked: preview-only CAD asset is not approved', 'error'); return; } if (format === 'dxf') { const text = CnbCadExport.exportDxf(state.model); const audit = clientAuditDxf(text); download(`${base}.dxf`, text, 'application/dxf'); showToast(audit.valid ? `DXF exported · ${audit.entityCount} entities audited` : 'DXF export failed audit', audit.valid ? 'info' : 'error'); } else if (format === 'svg') { download(`${base}.svg`, CnbCadExport.exportSvg(state.model), 'image/svg+xml'); showToast('SVG preview exported'); } else { download(`${base}.canonical.json`, `${JSON.stringify(state.model, null, 2)}\n`, 'application/json'); showToast('Canonical model exported'); } }
  function screenPointForModel(modelPoint) { const svg = $('#panelSvg'); const point = svg.createSVGPoint(); point.x = modelPoint.x; point.y = state.model.enclosure.height - modelPoint.y; const screen = point.matrixTransform(svg.getScreenCTM()); return { x: screen.x, y: screen.y }; }
  function zoomAt(event, nextZoom) { const before = pointerToModel(event); state.zoom = Math.max(.1, Math.min(20, nextZoom)); render(); const after = screenPointForModel(before); state.panX += event.clientX - after.x; state.panY += event.clientY - after.y; render(); }
  function focusComponent(component) { const viewport = $('#canvasViewport').getBoundingClientRect(); const center = CnbCadExport.center(component); state.zoom = Math.max(state.zoom, Math.min(20, 3.5)); render(); const screen = screenPointForModel(center); state.panX += viewport.left + viewport.width / 2 - screen.x; state.panY += viewport.top + viewport.height / 2 - screen.y; render(); }
  function fitCanvas() { const viewport = $('#canvasViewport').getBoundingClientRect(); state.zoom = 1; state.panX = 0; state.panY = 0; render(); const svgBox = $('#panelSvg').getBoundingClientRect(); const margin = 28; const fitZoom = Math.max(.1, Math.min(20, Math.min((viewport.width - margin) / svgBox.width, (viewport.height - margin) / svgBox.height))); state.zoom = fitZoom; render(); const target = { x: viewport.left + viewport.width / 2, y: viewport.top + viewport.height / 2 }; const screen = screenPointForModel({ x: state.model.enclosure.width / 2, y: state.model.enclosure.height / 2 }); state.panX += target.x - screen.x; state.panY += target.y - screen.y; render(); }
  function loadModel(raw, label) { const adapted = CnbEirAdapter.adapt(raw); state.model = CnbCadExport.normalizeModel(adapted); state.selectedId = null; assignDemoAssets(); validate(); fitCanvas(); showToast(`${label || state.model.project.name} loaded`); }

  function renderAssetLibrary() {
    const list = $('#assetList'); if (!list) return;
    const query = $('#librarySearch').value.toLowerCase();
    const records = state.assetCatalog.filter((asset) => `${asset.relative_path} ${asset.candidate_description || ''} ${asset.product_family || ''}`.toLowerCase().includes(query));
    list.innerHTML = records.map((asset) => { const source = asset.source_bbox || asset.bbox; const dimensions = asset.unit_confidence === 'confirmed-from-dxf' || asset.unit_confidence === 'confirmed-by-review' ? `${Number(asset.physical_width_mm).toFixed(2)} × ${Number(asset.physical_height_mm).toFixed(2)} mm` : `${Number(source?.width || 0).toFixed(2)} × ${Number(source?.height || 0).toFixed(2)} source units`; const badge = asset.review_state === 'approved-footprint' ? 'REVIEW-APPROVED FOOTPRINT' : asset.drawing_sheet ? 'DRAWING SHEET' : asset.unit_confidence === 'unknown' ? 'UNIT UNKNOWN' : asset.candidate_view === null ? 'VIEW UNKNOWN' : asset.review_state; return `<button class="asset-card" type="button" data-asset-id="${assetKey(asset)}" title="${asset.relative_path}"><img loading="lazy" src="${assetPreview(asset)}" alt=""><span><strong>${asset.candidate_description || asset.relative_path}</strong><small>${asset.product_family || 'Unknown family'} · ${asset.candidate_view || 'unknown view'}<br>${dimensions} · ${asset.parse_status}</small><span class="asset-badge ${asset.review_state === 'approved-footprint' ? 'approved' : ''}">${badge}</span></span></button>`; }).join('');
    $$('.asset-card', list).forEach((item) => item.addEventListener('click', () => { state.selectedAssetId = item.dataset.assetId; renderAssetDetail(); }));
    renderAssetDetail();
  }

  function renderAssetDetail() {
    const detail = $('#assetDetail'); const asset = state.assetCatalog.find((candidate) => assetKey(candidate) === state.selectedAssetId); if (!detail || !asset) { if (detail) detail.hidden = true; return; }
    const source = asset.source_bbox || asset.bbox || {}; const approved = assetApproved(asset); detail.hidden = false; detail.innerHTML = `<h3>${asset.candidate_description || asset.relative_path}</h3><img src="${assetPreview(asset)}" alt="CAD preview"><dl><div><dt>Manufacturer</dt><dd>${asset.manufacturer || 'unknown'}</dd></div><div><dt>Family</dt><dd>${asset.product_family || 'unknown'}</dd></div><div><dt>View</dt><dd>${asset.candidate_view || 'unknown'}</dd></div><div><dt>Source</dt><dd>${asset.source_group}</dd></div><div><dt>Raw bounds</dt><dd>${Number(source.width || 0).toFixed(2)} × ${Number(source.height || 0).toFixed(2)} ${asset.source_units || 'source units'}</dd></div><div><dt>Physical mm</dt><dd>${asset.physical_width_mm ? `${Number(asset.physical_width_mm).toFixed(2)} × ${Number(asset.physical_height_mm).toFixed(2)} mm` : 'not confirmed'}</dd></div><div><dt>Depth mm</dt><dd>${asset.physical_depth_mm || 'not confirmed'}</dd></div><div><dt>Product candidate</dt><dd>${asset.product_id || 'unknown'}</dd></div><div><dt>Review</dt><dd>${asset.review_state || 'needs-review'}</dd></div></dl><span class="asset-badge ${approved ? 'approved' : ''}">${approved ? 'REVIEW-APPROVED TEST FOOTPRINT' : 'PREVIEW ONLY · NOT AUTHORITATIVE'}</span>${asset.drawing_sheet ? '<span class="asset-badge">DRAWING SHEET · MANUAL EXTRACTION</span>' : ''}<form class="review-form" id="assetReviewForm"><div class="form-grid"><label>Unit<select name="unit"><option value="">Unknown</option><option value="mm">mm</option></select></label><label>View<select name="view"><option value="">Unknown</option><option value="front">front</option><option value="side">side</option><option value="top">top</option></select></label></div><div class="form-grid"><label>Physical width mm<input name="width" type="number" min="0.01" step="0.0001"></label><label>Physical height mm<input name="height" type="number" min="0.01" step="0.0001"></label></div><button class="button primary" type="submit">Approve footprint</button><button class="button subtle" id="addPreviewAsset" type="button">Add preview-only component</button></form>`;
    const form = $('#assetReviewForm'); form.elements.unit.value = asset.unit_confidence === 'confirmed-from-dxf' || asset.unit_confidence === 'confirmed-by-review' ? 'mm' : ''; form.elements.view.value = asset.candidate_view || ''; form.elements.width.value = asset.physical_width_mm || ''; form.elements.height.value = asset.physical_height_mm || ''; $('#addPreviewAsset').textContent = approved ? 'Add approved footprint' : 'Add preview-only component';
    form.addEventListener('submit', async (event) => { event.preventDefault(); const unit = form.elements.unit.value; const width = finite(form.elements.width.value, 0); const height = finite(form.elements.height.value, 0); const view = form.elements.view.value; if (asset.drawing_sheet) { showToast('Drawing sheet requires manual extraction before approval', 'error'); return; } if (!unit || unit !== 'mm' || width <= 0 || height <= 0 || !view) { showToast('Approval requires mm unit, physical bounds and a view', 'error'); return; } const response = await fetch('/api/catalog/reviews', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source_asset_id: assetKey(asset), representation_id: asset.representation_id, confirmed_view: view, physical_width_mm: width, physical_height_mm: height }) }); const payload = await response.json(); if (!response.ok) { showToast(`Approval failed: ${payload.error || response.status}`, 'error'); return; } const updated = payload.catalog.records.find((item) => assetKey(item) === assetKey(asset)); if (updated) { const index = state.assetCatalog.findIndex((item) => assetKey(item) === assetKey(asset)); state.assetCatalog[index] = updated; } renderAssetLibrary(); renderAssetDetail(); showToast('Review-approved test footprint persisted'); });
    $('#addPreviewAsset').addEventListener('click', () => addAssetComponent(asset, assetApproved(asset)));
  }

  function addAssetComponent(asset, approved) { const next = nextDeviceIndex(); const component = componentFrom('plc', next, state.model.enclosure.width / 2, state.model.enclosure.height / 2); component.name = asset.candidate_description || 'Imported CAD asset'; component.partNumber = `CAD-${assetKey(asset)}`; component.assetId = assetKey(asset); component.footprintRef = assetApproved(asset) ? asset.physical_footprint_id : null; component.mounting = 'Plate'; if (approved && assetApproved(asset)) { component.width = asset.physical_width_mm; component.height = asset.physical_height_mm; } else { component.width = 75; component.height = 100; } component.x = snap(state.model.enclosure.width / 2 - component.width / 2, GRID_MM); component.y = snap(state.model.enclosure.height / 2 - component.height / 2, GRID_MM); state.model.components.push(component); state.selectedId = component.id; validate(); render(); showToast(approved ? 'Review-approved footprint added to panel' : 'Preview-only asset added; excluded from authoritative layout'); }

  async function loadAssetCatalog() { try { const response = await fetch('/api/catalog'); if (!response.ok) throw new Error(`HTTP ${response.status}`); const manifest = await response.json(); state.assetCatalog = manifest.records || []; assignDemoAssets(); renderAssetLibrary(); render(); $('#libraryCount').textContent = String(state.assetCatalog.length); } catch (error) { showToast(`CAD catalog unavailable: ${error.message}`, 'error'); } }

  function wireEvents() {
    $('#loadScenario').addEventListener('click', async () => { const key = $('#scenarioSelect').value; if (key === 'r2' || key === 'r2b') { const response = await fetch(`/api/benchmark/${key}`); if (!response.ok) { showToast(`${key.toUpperCase()} benchmark unavailable; run the benchmark builder`, 'error'); return; } loadModel(await response.json(), $('#scenarioSelect option:checked').textContent); } else loadModel(scenarios[key](), $('#scenarioSelect option:checked').textContent); });
    $('#jsonInput').addEventListener('change', async (event) => { const file = event.target.files?.[0]; if (!file) return; try { loadModel(JSON.parse(await file.text()), file.name); } catch (error) { showToast(`Could not read JSON: ${error.message}`, 'error'); } event.target.value = ''; });
    $('#autoLayout').addEventListener('click', autoLayout); $('#zoomIn').addEventListener('click', () => zoomAt({ clientX: $('#canvasViewport').getBoundingClientRect().left + $('#canvasViewport').clientWidth / 2, clientY: $('#canvasViewport').getBoundingClientRect().top + $('#canvasViewport').clientHeight / 2 }, state.zoom * 1.25)); $('#zoomOut').addEventListener('click', () => zoomAt({ clientX: $('#canvasViewport').getBoundingClientRect().left + $('#canvasViewport').clientWidth / 2, clientY: $('#canvasViewport').getBoundingClientRect().top + $('#canvasViewport').clientHeight / 2 }, state.zoom / 1.25)); $('#fitCanvas').addEventListener('click', fitCanvas); $('#toggleGrid').addEventListener('click', () => { state.grid = !state.grid; render(); });
    $('#librarySearch').addEventListener('input', (event) => { const query = event.target.value.toLowerCase(); $$('.library-item').forEach((item) => { item.hidden = !item.textContent.toLowerCase().includes(query); }); renderAssetLibrary(); });
    $('#componentTab').addEventListener('click', () => { state.libraryMode = 'components'; $('#componentTab').classList.add('active'); $('#assetTab').classList.remove('active'); $('#componentTab').setAttribute('aria-selected', 'true'); $('#assetTab').setAttribute('aria-selected', 'false'); $('#libraryList').hidden = false; $('#assetList').hidden = true; });
    $('#assetTab').addEventListener('click', () => { state.libraryMode = 'assets'; $('#assetTab').classList.add('active'); $('#componentTab').classList.remove('active'); $('#componentTab').setAttribute('aria-selected', 'false'); $('#assetTab').setAttribute('aria-selected', 'true'); $('#libraryList').hidden = true; $('#assetList').hidden = false; renderAssetLibrary(); });
    $('#exportMenu').addEventListener('click', () => { const menu = $('#exportMenuItems'); menu.hidden = !menu.hidden; $('#exportMenu').setAttribute('aria-expanded', String(!menu.hidden)); }); $$('#exportMenuItems button').forEach((button) => button.addEventListener('click', () => { exportFormat(button.dataset.export); $('#exportMenuItems').hidden = true; $('#exportMenu').setAttribute('aria-expanded', 'false'); }));
    $('#inspectorForm').addEventListener('change', (event) => { if (event.target.name) updateSelected(event.target.name, event.target.value); }); $('#deleteComponent').addEventListener('click', removeSelected);
    const svg = $('#panelSvg'); const viewport = $('#canvasViewport');
    viewport.addEventListener('wheel', (event) => { event.preventDefault(); zoomAt(event, state.zoom * Math.exp(-event.deltaY * 0.0015)); }, { passive: false });
    viewport.addEventListener('contextmenu', (event) => event.preventDefault());
    svg.addEventListener('dragover', (event) => { if (event.dataTransfer.types.includes('text/cnb-component')) event.preventDefault(); });
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

  renderLibrary(); wireEvents(); validate(); fitCanvas(); loadAssetCatalog(); window.CNB_APP = { state, loadModel, autoLayout, validate, exportFormat, scenarios, zoomAt, fitCanvas, pointerToModel, render };
}());
