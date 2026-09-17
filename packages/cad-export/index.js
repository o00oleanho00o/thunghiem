'use strict';

// Small, dependency-free CAD boundary. Coordinates are always millimetres and
// use a bottom-left origin, matching the EIR contract.

const escXml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const safeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const fixed = (value) => {
  const number = safeNumber(value);
  return Number(number.toFixed(4));
};

const slug = (value) => String(value || 'item')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '') || 'item';

function dimensions(item) {
  const footprint = item && item.footprint ? item.footprint : {};
  return {
    width: Math.max(1, safeNumber(item && (item.width ?? footprint.width), 40)),
    height: Math.max(1, safeNumber(item && (item.height ?? footprint.height), 30)),
    depth: Math.max(1, safeNumber(item && (item.depth ?? footprint.depth), 50)),
  };
}

function normalizeModel(input = {}) {
  const source = input || {};
  const enclosureSource = source.enclosure || {};
  const enclosure = {
    id: enclosureSource.id || 'enclosure-main',
    name: enclosureSource.name || 'Control cabinet',
    width: Math.max(100, safeNumber(enclosureSource.width, 800)),
    height: Math.max(100, safeNumber(enclosureSource.height, 1200)),
    depth: Math.max(50, safeNumber(enclosureSource.depth, 300)),
  };
  const plateSource = source.mountingPlate || {};
  const plate = {
    id: plateSource.id || 'plate-main',
    x: safeNumber(plateSource.x, 40),
    y: safeNumber(plateSource.y, 40),
    width: Math.max(20, safeNumber(plateSource.width, enclosure.width - 80)),
    height: Math.max(20, safeNumber(plateSource.height, enclosure.height - 80)),
  };
  const rails = (Array.isArray(source.rails) ? source.rails : []).map((rail, index) => ({
    id: rail.id || `rail-${index + 1}`,
    type: rail.type || 'DIN-rail-35',
    x: safeNumber(rail.x, plate.x),
    y: safeNumber(rail.y, plate.y + plate.height - 80 - index * 120),
    length: Math.max(20, safeNumber(rail.length, plate.width)),
    height: Math.max(5, safeNumber(rail.height, 7.5)),
  }));
  const ducts = (Array.isArray(source.ducts) ? source.ducts : []).map((duct, index) => ({
    id: duct.id || `duct-${index + 1}`,
    x: safeNumber(duct.x, plate.x + 10),
    y: safeNumber(duct.y, plate.y + 10),
    width: Math.max(8, safeNumber(duct.width, 40)),
    height: Math.max(8, safeNumber(duct.height, 120)),
    orientation: duct.orientation || 'vertical',
  }));
  const components = (Array.isArray(source.components) ? source.components : []).map((component, index) => {
    const size = dimensions(component);
    return {
      id: component.id || `device-${String(index + 1).padStart(3, '0')}`,
      tag: component.tag || component.deviceTag || `-Q${index + 1}`,
      name: component.name || component.description || component.kind || 'Component',
      kind: component.kind || 'device',
      manufacturer: component.manufacturer || '',
      partNumber: component.partNumber || component.mpn || '',
      group: component.group || component.function || 'General',
      width: size.width,
      height: size.height,
      depth: size.depth,
      x: safeNumber(component.x, plate.x + 30 + (index % 6) * 100),
      y: safeNumber(component.y, plate.y + plate.height - 100 - Math.floor(index / 6) * 100),
      rotation: [0, 90, 180, 270].includes(Number(component.rotation)) ? Number(component.rotation) : 0,
      railId: component.railId || null,
      terminals: Array.isArray(component.terminals) ? component.terminals : [],
      mounting: component.mounting || 'DIN',
      color: component.color || '#3b82f6',
      assetId: component.assetId || component.source_asset_id || null,
      source_asset_id: component.source_asset_id || component.assetId || null,
      footprintRef: component.footprintRef || component.footprint_ref || null,
      footprint_ref: component.footprint_ref || component.footprintRef || null,
      metadata: component.metadata || {},
      // Transient imported geometry is attached by the export boundary from
      // the vector cache. It is never part of canonical EIR persistence.
      cadGeometry: Array.isArray(component.cadGeometry) ? component.cadGeometry : null,
      cadGeometryBounds: component.cadGeometryBounds || null,
      cadGeometryScale: safeNumber(component.cadGeometryScale, 1),
    };
  });
  const connections = (Array.isArray(source.connections) ? source.connections : []).map((connection, index) => ({
    id: connection.id || `connection-${index + 1}`,
    from: connection.from || connection.source || '',
    to: connection.to || connection.target || '',
    label: connection.label || connection.net || '',
    kind: connection.kind || 'wire',
  }));
  return {
    schemaVersion: source.schemaVersion || 'eir-0.1',
    units: 'mm',
    project: {
      id: (source.project && source.project.id) || 'demo-panel',
      name: (source.project && source.project.name) || 'CNB Electrical Lab panel',
      revision: (source.project && source.project.revision) || 'A',
    },
    enclosure,
    mountingPlate: plate,
    rails,
    ducts,
    components,
    connections,
    metadata: source.metadata || {},
  };
}

function rotatedSize(component) {
  const angle = ((Number(component.rotation) % 360) + 360) % 360;
  return angle === 90 || angle === 270
    ? { width: component.height, height: component.width }
    : { width: component.width, height: component.height };
}

function componentRect(component) {
  const size = rotatedSize(component);
  return { x: component.x, y: component.y, width: size.width, height: size.height };
}

function centerOf(item) {
  const rect = componentRect(item);
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function modelBounds(model) {
  const normalized = normalizeModel(model);
  return { x: 0, y: 0, width: normalized.enclosure.width, height: normalized.enclosure.height };
}

function lineEntity(x1, y1, x2, y2, layer = '0') {
  return ['0', 'LINE', '8', layer, '10', fixed(x1), '20', fixed(y1), '30', '0', '11', fixed(x2), '21', fixed(y2), '31', '0'];
}

function rectEntities(x, y, width, height, layer) {
  return [].concat(
    lineEntity(x, y, x + width, y, layer),
    lineEntity(x + width, y, x + width, y + height, layer),
    lineEntity(x + width, y + height, x, y + height, layer),
    lineEntity(x, y + height, x, y, layer),
  );
}

function textEntity(text, x, y, height = 12, layer = 'TEXT') {
  return ['0', 'TEXT', '8', layer, '10', fixed(x), '20', fixed(y), '30', '0', '40', fixed(height), '1', String(text || '').replace(/[\r\n]/g, ' ')];
}

function circleEntity(x, y, radius, layer = 'TERMINAL') {
  return ['0', 'CIRCLE', '8', layer, '10', fixed(x), '20', fixed(y), '30', '0', '40', fixed(radius)];
}

function arcEntity(cx, cy, radius, start, end, layer = 'CAD_GEOMETRY') {
  return ['0', 'ARC', '8', layer, '10', fixed(cx), '20', fixed(cy), '30', '0', '40', fixed(radius), '50', fixed(start), '51', fixed(end)];
}

function transformCadPoint(point, component, bounds, scale) {
  const minX = safeNumber(bounds && (bounds.min_x ?? bounds.minX), 0);
  const minY = safeNumber(bounds && (bounds.min_y ?? bounds.minY), 0);
  const px = (safeNumber(point.x) - minX) * scale;
  const py = (safeNumber(point.y) - minY) * scale;
  const angle = ((Number(component.rotation) % 360) + 360) % 360;
  const width = safeNumber(bounds && (bounds.width ?? (bounds.max_x - bounds.min_x)), component.width) * scale;
  const height = safeNumber(bounds && (bounds.height ?? (bounds.max_y - bounds.min_y)), component.height) * scale;
  if (angle === 90) return { x: component.x + height - py, y: component.y + px };
  if (angle === 180) return { x: component.x + width - px, y: component.y + height - py };
  if (angle === 270) return { x: component.x + py, y: component.y + width - px };
  return { x: component.x + px, y: component.y + py };
}

function cadGeometryEntities(component) {
  if (!Array.isArray(component.cadGeometry) || !component.cadGeometry.length) return [];
  const bounds = component.cadGeometryBounds || {};
  const scale = safeNumber(component.cadGeometryScale, 1);
  const entities = [];
  component.cadGeometry.forEach((geometry) => {
    if (geometry.type === 'line') {
      const a = transformCadPoint({ x: geometry.x1, y: geometry.y1 }, component, bounds, scale);
      const b = transformCadPoint({ x: geometry.x2, y: geometry.y2 }, component, bounds, scale);
      entities.push(...lineEntity(a.x, a.y, b.x, b.y, 'CAD_GEOMETRY'));
    } else if (geometry.type === 'circle') {
      const center = transformCadPoint({ x: geometry.cx, y: geometry.cy }, component, bounds, scale);
      entities.push(...circleEntity(center.x, center.y, safeNumber(geometry.r, 1) * scale, 'CAD_GEOMETRY'));
    } else if (geometry.type === 'arc') {
      const center = transformCadPoint({ x: geometry.cx, y: geometry.cy }, component, bounds, scale);
      entities.push(...arcEntity(center.x, center.y, safeNumber(geometry.r, 1) * scale, safeNumber(geometry.start), safeNumber(geometry.end), 'CAD_GEOMETRY'));
    }
  });
  return entities;
}

function connectionPoint(model, id) {
  const component = model.components.find((item) => item.id === id || item.tag === id);
  if (!component) return null;
  return centerOf(component);
}

function exportDxf(input) {
  const model = normalizeModel(input);
  const lines = [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$ACADVER', '1', 'AC1009',
    '9', '$INSUNITS', '70', '4',
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    '999', `CNB Electrical Lab | ${model.project.name} | ${model.project.revision}`,
  ];
  lines.push(...rectEntities(0, 0, model.enclosure.width, model.enclosure.height, 'ENCLOSURE'));
  lines.push(...rectEntities(model.mountingPlate.x, model.mountingPlate.y, model.mountingPlate.width, model.mountingPlate.height, 'MOUNTING_PLATE'));
  lines.push(...textEntity(model.enclosure.name, 20, model.enclosure.height - 25, 12, 'TEXT'));
  model.rails.forEach((rail) => {
    lines.push(...rectEntities(rail.x, rail.y, rail.length, rail.height, 'DIN_RAIL'));
    lines.push(...textEntity(rail.id, rail.x + 2, rail.y + rail.height + 4, 6, 'TEXT'));
  });
  model.ducts.forEach((duct) => {
    lines.push(...rectEntities(duct.x, duct.y, duct.width, duct.height, 'WIRE_DUCT'));
  });
  model.components.forEach((component) => {
    const rect = componentRect(component);
    const cad = cadGeometryEntities(component);
    if (cad.length) lines.push(...cad);
    lines.push(...rectEntities(rect.x, rect.y, rect.width, rect.height, 'COMPONENT'));
    lines.push(...rectEntities(rect.x, rect.y, rect.width, rect.height, 'COMPONENT_OUTLINE'));
    lines.push(...lineEntity(rect.x + rect.width / 2 - Math.min(4, rect.width / 4), rect.y + rect.height / 2, rect.x + rect.width / 2 + Math.min(4, rect.width / 4), rect.y + rect.height / 2, 'COMPONENT_DETAIL'));
    lines.push(...textEntity(component.tag, rect.x + 3, rect.y + rect.height / 2, Math.max(5, Math.min(12, rect.height / 4)), 'TAG'));
    lines.push(...textEntity(component.name, rect.x + 3, rect.y + Math.min(10, rect.height - 3), 4, 'TEXT'));
    const terminalCount = Math.max(0, component.terminals.length || 2);
    for (let index = 0; index < terminalCount; index += 1) {
      const px = rect.x + ((index + 1) / (terminalCount + 1)) * rect.width;
      lines.push(...circleEntity(px, rect.y, 1.5, 'TERMINAL'));
    }
  });
  model.connections.forEach((connection) => {
    const from = connectionPoint(model, connection.from);
    const to = connectionPoint(model, connection.to);
    if (from && to) {
      lines.push(...lineEntity(from.x, from.y, to.x, to.y, 'WIRE'));
      if (connection.label) lines.push(...textEntity(connection.label, (from.x + to.x) / 2, (from.y + to.y) / 2, 4, 'WIRE_LABEL'));
    }
  });
  lines.push('0', 'ENDSEC', '0', 'EOF', '');
  return lines.join('\r\n');
}

function svgRect(x, y, width, height, attrs = '') {
  return `<rect x="${fixed(x)}" y="${fixed(y)}" width="${fixed(width)}" height="${fixed(height)}" ${attrs}/>`;
}

function cadGeometrySvg(component, yTop) {
  if (!Array.isArray(component.cadGeometry) || !component.cadGeometry.length) return '';
  const bounds = component.cadGeometryBounds || {};
  const scale = safeNumber(component.cadGeometryScale, 1);
  const point = (x, y) => transformCadPoint({ x, y }, component, bounds, scale);
  const attr = 'class="cad-geometry" fill="none" stroke="#f8fafc" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"';
  const output = [];
  component.cadGeometry.forEach((geometry) => {
    if (geometry.type === 'line') {
      const a = point(geometry.x1, geometry.y1);
      const b = point(geometry.x2, geometry.y2);
      output.push(`<line ${attr} x1="${fixed(a.x)}" y1="${fixed(yTop(a.y))}" x2="${fixed(b.x)}" y2="${fixed(yTop(b.y))}"/>`);
    } else if (geometry.type === 'circle') {
      const center = point(geometry.cx, geometry.cy);
      output.push(`<circle ${attr} cx="${fixed(center.x)}" cy="${fixed(yTop(center.y))}" r="${fixed(Math.abs(safeNumber(geometry.r, 1) * scale))}"/>`);
    } else if (geometry.type === 'arc') {
      const radius = Math.abs(safeNumber(geometry.r, 1) * scale);
      const start = safeNumber(geometry.start);
      const end = safeNumber(geometry.end);
      const delta = ((end - start) % 360 + 360) % 360;
      const center = point(geometry.cx, geometry.cy);
      // A full-circle ARC has coincident endpoints, so emit a circle instead.
      if (delta === 0) {
        output.push(`<circle ${attr} cx="${fixed(center.x)}" cy="${fixed(yTop(center.y))}" r="${fixed(radius)}"/>`);
        return;
      }
      const startPoint = point(geometry.cx + safeNumber(geometry.r, 1) * Math.cos(start * Math.PI / 180), geometry.cy + safeNumber(geometry.r, 1) * Math.sin(start * Math.PI / 180));
      const endPoint = point(geometry.cx + safeNumber(geometry.r, 1) * Math.cos(end * Math.PI / 180), geometry.cy + safeNumber(geometry.r, 1) * Math.sin(end * Math.PI / 180));
      output.push(`<path ${attr} d="M ${fixed(startPoint.x)} ${fixed(yTop(startPoint.y))} A ${fixed(radius)} ${fixed(radius)} 0 ${delta > 180 ? 1 : 0} 0 ${fixed(endPoint.x)} ${fixed(yTop(endPoint.y))}"/>`);
    }
  });
  return output.join('');
}

function exportSvg(input, options = {}) {
  const model = normalizeModel(input);
  const { width: outputWidth = 1200 } = options;
  const bounds = modelBounds(model);
  const yTop = (y, h = 0) => bounds.height - y - h;
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fixed(bounds.width)} ${fixed(bounds.height)}" width="${outputWidth}" role="img" aria-label="${escXml(model.project.name)}">`);
  parts.push('<style>text{font-family:Arial,sans-serif} .label{font-size:11px;fill:#dbeafe} .tiny{font-size:5px;fill:#cbd5e1} .wire{stroke:#f59e0b;stroke-width:2;fill:none} .component{stroke:#93c5fd;stroke-width:1.5} </style>');
  parts.push(svgRect(0, 0, bounds.width, bounds.height, 'fill="#0b1220" stroke="#64748b" stroke-width="3"'));
  parts.push(svgRect(model.mountingPlate.x, yTop(model.mountingPlate.y, model.mountingPlate.height), model.mountingPlate.width, model.mountingPlate.height, 'fill="#111827" stroke="#64748b" stroke-width="2"'));
  model.rails.forEach((rail) => {
    parts.push(svgRect(rail.x, yTop(rail.y, rail.height), rail.length, rail.height, 'fill="#475569" stroke="#cbd5e1" stroke-width="1"'));
  });
  model.ducts.forEach((duct) => {
    parts.push(svgRect(duct.x, yTop(duct.y, duct.height), duct.width, duct.height, 'fill="#1e293b" stroke="#64748b" stroke-dasharray="5 3"'));
  });
  model.connections.forEach((connection) => {
    const from = connectionPoint(model, connection.from);
    const to = connectionPoint(model, connection.to);
    if (from && to) {
      parts.push(`<line class="wire" x1="${fixed(from.x)}" y1="${fixed(yTop(from.y))}" x2="${fixed(to.x)}" y2="${fixed(yTop(to.y))}"/>`);
    }
  });
  model.components.forEach((component) => {
    const rect = componentRect(component);
    const hasCadGeometry = Array.isArray(component.cadGeometry) && component.cadGeometry.length > 0;
    parts.push(svgRect(rect.x, yTop(rect.y, rect.height), rect.width, rect.height, `class="component" fill="${escXml(component.color)}" fill-opacity="${hasCadGeometry ? '0.10' : '0.82'}" rx="2"`));
    if (hasCadGeometry) parts.push(cadGeometrySvg(component, yTop));
    parts.push(`<text class="label" x="${fixed(rect.x + 3)}" y="${fixed(yTop(rect.y + rect.height / 2) + 4)}">${escXml(component.tag)}</text>`);
    parts.push(`<text class="tiny" x="${fixed(rect.x + 3)}" y="${fixed(yTop(rect.y + 8))}">${escXml(component.name)}</text>`);
  });
  parts.push(`<text class="label" x="20" y="25">${escXml(model.enclosure.name)} · ${escXml(model.project.revision)}</text>`);
  parts.push('</svg>');
  return parts.join('');
}

function parsePairs(input) {
  const lines = String(input || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const pairs = [];
  const errors = [];
  for (let index = 0; index < lines.length; index += 2) {
    if (lines[index] === '' && index === lines.length - 1) continue;
    if (index + 1 >= lines.length) {
      if (lines[index] !== '') errors.push(`Dangling group code at line ${index + 1}`);
      break;
    }
    const code = Number(String(lines[index]).trim());
    if (!Number.isInteger(code)) {
      errors.push(`Invalid group code at line ${index + 1}: ${lines[index]}`);
      continue;
    }
    pairs.push({ code, value: lines[index + 1] });
  }
  return { pairs, errors };
}

function auditDxf(input) {
  const { pairs, errors } = parsePairs(input);
  const sections = [];
  const counts = {};
  let currentSection = null;
  let inEntities = false;
  let entity = null;
  const points = [];
  const addPoint = (x, y) => {
    const px = Number(x); const py = Number(y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) errors.push(`Non-finite coordinate (${x}, ${y})`);
    else points.push({ x: px, y: py });
  };
  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index];
    if (pair.code === 0 && pair.value === 'SECTION') {
      const next = pairs[index + 1];
      currentSection = next && next.code === 2 ? next.value : null;
      if (currentSection) sections.push(currentSection);
      inEntities = currentSection === 'ENTITIES';
      continue;
    }
    if (pair.code === 0 && pair.value === 'ENDSEC') {
      currentSection = null; inEntities = false; continue;
    }
    if (inEntities && pair.code === 0) {
      entity = pair.value;
      if (entity !== 'ENDSEC' && entity !== 'EOF') counts[entity] = (counts[entity] || 0) + 1;
      continue;
    }
    if (inEntities && entity && (pair.code === 10 || pair.code === 11)) {
      const next = pairs[index + 1];
      if (next && (next.code === 20 || next.code === 21)) addPoint(pair.value, next.value);
    }
  }
  if (!sections.includes('HEADER')) errors.push('Missing HEADER section');
  if (!sections.includes('ENTITIES')) errors.push('Missing ENTITIES section');
  if (!pairs.some((pair) => pair.code === 0 && pair.value === 'EOF')) errors.push('Missing EOF marker');
  const bounds = points.length ? {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  } : null;
  const entityCount = Object.values(counts).reduce((total, count) => total + count, 0);
  return { valid: errors.length === 0 && entityCount > 0, errors, warnings: [], sections, entityCount, counts, bounds };
}

function entitiesFromDxf(input) {
  const { pairs } = parsePairs(input);
  const entities = [];
  let inEntities = false;
  let current = null;
  const flush = () => { if (current && current.type) entities.push(current); current = null; };
  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index];
    if (pair.code === 0 && pair.value === 'SECTION') {
      const next = pairs[index + 1];
      inEntities = Boolean(next && next.code === 2 && next.value === 'ENTITIES');
      continue;
    }
    if (pair.code === 0 && pair.value === 'ENDSEC') { flush(); inEntities = false; continue; }
    if (!inEntities) continue;
    if (pair.code === 0) { flush(); current = { type: pair.value, layer: '0' }; continue; }
    if (!current) continue;
    if (pair.code === 8) current.layer = pair.value;
    else if (pair.code === 10) current.x = safeNumber(pair.value);
    else if (pair.code === 20) current.y = safeNumber(pair.value);
    else if (pair.code === 11) current.x2 = safeNumber(pair.value);
    else if (pair.code === 21) current.y2 = safeNumber(pair.value);
    else if (pair.code === 40) current.size = safeNumber(pair.value);
    else if (pair.code === 1) current.text = pair.value;
  }
  flush();
  return entities;
}

function renderDxfToSvg(input, options = {}) {
  const entities = entitiesFromDxf(input);
  const allPoints = [];
  entities.forEach((entity) => {
    if (Number.isFinite(entity.x) && Number.isFinite(entity.y)) allPoints.push({ x: entity.x, y: entity.y });
    if (Number.isFinite(entity.x2) && Number.isFinite(entity.y2)) allPoints.push({ x: entity.x2, y: entity.y2 });
  });
  const configured = options.bounds || {};
  const minX = safeNumber(configured.minX, allPoints.length ? Math.min(...allPoints.map((point) => point.x)) - 20 : 0);
  const minY = safeNumber(configured.minY, allPoints.length ? Math.min(...allPoints.map((point) => point.y)) - 20 : 0);
  const maxX = safeNumber(configured.maxX, allPoints.length ? Math.max(...allPoints.map((point) => point.x)) + 20 : 1000);
  const maxY = safeNumber(configured.maxY, allPoints.length ? Math.max(...allPoints.map((point) => point.y)) + 20 : 1000);
  const width = Math.max(1, maxX - minX); const height = Math.max(1, maxY - minY);
  const sy = (y) => maxY - y;
  const colorFor = (layer) => ({ ENCLOSURE: '#94a3b8', MOUNTING_PLATE: '#64748b', COMPONENT: '#60a5fa', DIN_RAIL: '#cbd5e1', WIRE_DUCT: '#475569', WIRE: '#f59e0b', TAG: '#dbeafe', TEXT: '#cbd5e1', TERMINAL: '#f97316' }[layer] || '#a5b4fc');
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fixed(minX)} ${fixed(minY)} ${fixed(width)} ${fixed(height)}" width="${options.width || 1200}" role="img" aria-label="DXF render">`, '<style>text{font-family:Arial,sans-serif}</style>', '<rect x="0" y="0" width="100%" height="100%" fill="#0b1220"/>'];
  entities.forEach((entity) => {
    const color = colorFor(entity.layer);
    if (entity.type === 'LINE' && Number.isFinite(entity.x2)) out.push(`<line x1="${fixed(entity.x)}" y1="${fixed(sy(entity.y))}" x2="${fixed(entity.x2)}" y2="${fixed(sy(entity.y2))}" stroke="${color}" stroke-width="1.5"/>`);
    else if (entity.type === 'CIRCLE') out.push(`<circle cx="${fixed(entity.x)}" cy="${fixed(sy(entity.y))}" r="${fixed(entity.size || 1)}" fill="none" stroke="${color}" stroke-width="1"/>`);
    else if (entity.type === 'TEXT') out.push(`<text x="${fixed(entity.x)}" y="${fixed(sy(entity.y))}" font-size="${fixed(entity.size || 8)}" fill="${color}">${escXml(entity.text || '')}</text>`);
  });
  out.push('</svg>');
  return out.join('');
}

module.exports = {
  normalizeModel,
  rotatedSize,
  componentRect,
  exportDxf,
  exportSvg,
  auditDxf,
  renderDxfToSvg,
  entitiesFromDxf,
};
