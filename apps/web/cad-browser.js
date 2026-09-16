(function attachCadExport(global) {
  'use strict';

  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const fixed = (value) => Number(number(value).toFixed(4));
  const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const slug = (value) => String(value || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';

  function normalizeModel(source) {
    source = source || {};
    const e = source.enclosure || {};
    const enclosure = { id: e.id || 'enclosure-main', name: e.name || 'Control cabinet', width: Math.max(100, number(e.width, 800)), height: Math.max(100, number(e.height, 1200)), depth: Math.max(50, number(e.depth, 300)) };
    const p = source.mountingPlate || {};
    const plate = { id: p.id || 'plate-main', x: number(p.x, 40), y: number(p.y, 40), width: Math.max(20, number(p.width, enclosure.width - 80)), height: Math.max(20, number(p.height, enclosure.height - 80)) };
    const components = (Array.isArray(source.components) ? source.components : []).map((c, i) => {
      const fp = c.footprint || {};
      return { id: c.id || `device-${String(i + 1).padStart(3, '0')}`, tag: c.tag || c.deviceTag || `-Q${i + 1}`, name: c.name || c.description || c.kind || 'Component', kind: c.kind || 'device', manufacturer: c.manufacturer || '', partNumber: c.partNumber || c.mpn || '', group: c.group || c.function || 'General', width: Math.max(1, number(c.width ?? fp.width, 40)), height: Math.max(1, number(c.height ?? fp.height, 30)), depth: Math.max(1, number(c.depth ?? fp.depth, 50)), x: number(c.x, plate.x + 30 + (i % 6) * 100), y: number(c.y, plate.y + plate.height - 100 - Math.floor(i / 6) * 100), rotation: [0, 90, 180, 270].includes(Number(c.rotation)) ? Number(c.rotation) : 0, railId: c.railId || null, terminals: Array.isArray(c.terminals) ? c.terminals : [], mounting: c.mounting || 'DIN', color: c.color || '#3b82f6', metadata: c.metadata || {} };
    });
    const rails = (Array.isArray(source.rails) ? source.rails : []).map((r, i) => ({ id: r.id || `rail-${i + 1}`, type: r.type || 'DIN-rail-35', x: number(r.x, plate.x), y: number(r.y, plate.y + plate.height - 80 - i * 120), length: Math.max(20, number(r.length, plate.width)), height: Math.max(5, number(r.height, 7.5)) }));
    const ducts = (Array.isArray(source.ducts) ? source.ducts : []).map((d, i) => ({ id: d.id || `duct-${i + 1}`, x: number(d.x, plate.x + 10), y: number(d.y, plate.y + 10), width: Math.max(8, number(d.width, 40)), height: Math.max(8, number(d.height, 120)), orientation: d.orientation || 'vertical' }));
    const connections = (Array.isArray(source.connections) ? source.connections : []).map((c, i) => ({ id: c.id || `connection-${i + 1}`, from: c.from || c.source || '', to: c.to || c.target || '', label: c.label || c.net || '', kind: c.kind || 'wire' }));
    return { schemaVersion: source.schemaVersion || 'eir-0.1', units: 'mm', project: { id: source.project?.id || 'demo-panel', name: source.project?.name || 'CNB Electrical Lab panel', revision: source.project?.revision || 'A' }, enclosure, mountingPlate: plate, rails, ducts, components, connections, metadata: source.metadata || {} };
  }

  function rect(c) { const turn = c.rotation === 90 || c.rotation === 270; return { x: c.x, y: c.y, width: turn ? c.height : c.width, height: turn ? c.width : c.height }; }
  function center(c) { const r = rect(c); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }
  function line(x1, y1, x2, y2, layer) { return ['0', 'LINE', '8', layer, '10', fixed(x1), '20', fixed(y1), '30', '0', '11', fixed(x2), '21', fixed(y2), '31', '0']; }
  function rectangle(x, y, w, h, layer) { return [].concat(line(x, y, x + w, y, layer), line(x + w, y, x + w, y + h, layer), line(x + w, y + h, x, y + h, layer), line(x, y + h, x, y, layer)); }
  function text(value, x, y, size, layer) { return ['0', 'TEXT', '8', layer, '10', fixed(x), '20', fixed(y), '30', '0', '40', fixed(size), '1', String(value || '').replace(/[\r\n]/g, ' ')]; }
  function circle(x, y, radius, layer) { return ['0', 'CIRCLE', '8', layer, '10', fixed(x), '20', fixed(y), '30', '0', '40', fixed(radius)]; }

  function exportDxf(input) {
    const model = normalizeModel(input); const lines = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES', '999', `CNB Electrical Lab | ${model.project.name} | ${model.project.revision}`];
    lines.push(...rectangle(0, 0, model.enclosure.width, model.enclosure.height, 'ENCLOSURE'), ...rectangle(model.mountingPlate.x, model.mountingPlate.y, model.mountingPlate.width, model.mountingPlate.height, 'MOUNTING_PLATE'), ...text(model.enclosure.name, 20, model.enclosure.height - 25, 12, 'TEXT'));
    model.rails.forEach((r) => lines.push(...rectangle(r.x, r.y, r.length, r.height, 'DIN_RAIL')));
    model.ducts.forEach((d) => lines.push(...rectangle(d.x, d.y, d.width, d.height, 'WIRE_DUCT')));
    model.components.forEach((c) => { const r = rect(c); lines.push(...rectangle(r.x, r.y, r.width, r.height, 'COMPONENT'), ...text(c.tag, r.x + 3, r.y + r.height / 2, Math.max(5, Math.min(12, r.height / 4)), 'TAG'), ...text(c.name, r.x + 3, r.y + Math.min(10, r.height - 3), 4, 'TEXT')); const n = Math.max(0, c.terminals.length || 2); for (let i = 0; i < n; i += 1) lines.push(...circle(r.x + ((i + 1) / (n + 1)) * r.width, r.y, 1.5, 'TERMINAL')); });
    model.connections.forEach((wire) => { const a = model.components.find((c) => c.id === wire.from || c.tag === wire.from); const b = model.components.find((c) => c.id === wire.to || c.tag === wire.to); if (a && b) lines.push(...line(center(a).x, center(a).y, center(b).x, center(b).y, 'WIRE')); });
    lines.push('0', 'ENDSEC', '0', 'EOF', ''); return lines.join('\r\n');
  }

  function exportSvg(input) {
    const model = normalizeModel(input); const h = model.enclosure.height; const sy = (y, height = 0) => h - y - height; const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fixed(model.enclosure.width)} ${fixed(h)}" role="img" aria-label="${esc(model.project.name)}">`, '<style>text{font-family:Arial,sans-serif}.label{font-size:11px;fill:#dbeafe}.tiny{font-size:5px;fill:#cbd5e1}.wire{stroke:#f59e0b;stroke-width:2;fill:none}</style>', `<rect x="0" y="0" width="${fixed(model.enclosure.width)}" height="${fixed(h)}" fill="#0b1220" stroke="#64748b" stroke-width="3"/>`, `<rect x="${fixed(model.mountingPlate.x)}" y="${fixed(sy(model.mountingPlate.y, model.mountingPlate.height))}" width="${fixed(model.mountingPlate.width)}" height="${fixed(model.mountingPlate.height)}" fill="#111827" stroke="#64748b" stroke-width="2"/>`];
    model.rails.forEach((r) => out.push(`<rect x="${fixed(r.x)}" y="${fixed(sy(r.y, r.height))}" width="${fixed(r.length)}" height="${fixed(r.height)}" fill="#475569" stroke="#cbd5e1"/>`));
    model.ducts.forEach((d) => out.push(`<rect x="${fixed(d.x)}" y="${fixed(sy(d.y, d.height))}" width="${fixed(d.width)}" height="${fixed(d.height)}" fill="#1e293b" stroke="#64748b" stroke-dasharray="5 3"/>`));
    model.connections.forEach((wire) => { const a = model.components.find((c) => c.id === wire.from || c.tag === wire.from); const b = model.components.find((c) => c.id === wire.to || c.tag === wire.to); if (a && b) { const ca = center(a); const cb = center(b); out.push(`<line class="wire" x1="${fixed(ca.x)}" y1="${fixed(sy(ca.y))}" x2="${fixed(cb.x)}" y2="${fixed(sy(cb.y))}"/>`); } });
    model.components.forEach((c) => { const r = rect(c); out.push(`<rect data-component-id="${esc(c.id)}" x="${fixed(r.x)}" y="${fixed(sy(r.y, r.height))}" width="${fixed(r.width)}" height="${fixed(r.height)}" fill="${esc(c.color)}" fill-opacity=".82" stroke="#93c5fd" stroke-width="1.5" rx="2"/>`, `<text pointer-events="none" class="label" x="${fixed(r.x + 3)}" y="${fixed(sy(r.y + r.height / 2) + 4)}">${esc(c.tag)}</text>`, `<text pointer-events="none" class="tiny" x="${fixed(r.x + 3)}" y="${fixed(sy(r.y + 8))}">${esc(c.name)}</text>`); });
    out.push(`<text class="label" x="20" y="25">${esc(model.enclosure.name)} · ${esc(model.project.revision)}</text>`, '</svg>'); return out.join('');
  }

  global.CnbCadExport = { normalizeModel, rect, center, exportDxf, exportSvg, slug };
}(window));
