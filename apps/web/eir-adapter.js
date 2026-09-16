(function attachEirAdapter(global) {
  'use strict';

  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const first = (...values) => values.find((value) => value !== undefined && value !== null);
  const idOf = (value, fallback) => (typeof value === 'string' ? value : value && (value.id || value.deviceId || value.device_id || value.partId || value.part_id)) || fallback;

  // Python EIR v1 keeps part definitions, devices, placements and enclosure
  // geometry in separate collections. The browser renderer consumes a flat
  // view model, so this adapter performs the explicit, one-way projection.
  function adapt(raw) {
    const source = raw || {};
    const enclosureSource = source.enclosure || source.cabinet || {};
    const plateSource = enclosureSource.plate || source.mountingPlate || {};
    const width = finite(first(enclosureSource.width, source.panelWidth), 800);
    const height = finite(first(enclosureSource.height, source.panelHeight), 1200);
    const partList = source.partDefinitions || source.parts || source.catalog || [];
    const parts = Array.isArray(partList) ? partList : Object.values(partList || {});
    const partById = new Map();
    parts.forEach((part) => {
      const key = idOf(part, '');
      if (key) partById.set(key, part);
      if (part && part.mpn) partById.set(part.mpn, part);
      if (part && part.manufacturerPart) partById.set(part.manufacturerPart, part);
      if (part && part.manufacturer_part) partById.set(part.manufacturer_part, part);
    });
    const placementList = source.placements || source.componentPlacements || [];
    const placements = Array.isArray(placementList) ? placementList : Object.values(placementList || {});
    const placementByDevice = new Map(placements.map((placement) => [idOf(placement, ''), placement]));
    const deviceList = source.devices || source.logicalDevices || source.components || [];
    const devices = Array.isArray(deviceList) ? deviceList : Object.values(deviceList || {});
    const components = devices.map((device, index) => {
      const deviceId = idOf(device, `device-${String(index + 1).padStart(3, '0')}`);
      const placement = placementByDevice.get(deviceId) || (device.placement || {});
      const part = partById.get(first(device.partId, device.part_id, device.partRef, device.part_ref, device.mpn, device.partNumber, device.part_number, '')) || {};
      const footprint = first(device.footprint, part.footprint, part.footprint2d, {}) || {};
      const dimensions = first(device.dimensions, {}) || {};
      const terminalIds = first(device.terminals, device.terminalIds, device.terminal_ids, part.terminals, []) || [];
      return {
        id: deviceId,
        tag: first(device.tag, device.deviceTag, device.reference, `-Q${index + 1}`),
        name: first(device.name, device.description, part.description, device.kind, 'Component'),
        kind: first(device.kind, device.type, part.kind, 'device'),
        manufacturer: first(device.manufacturer, part.manufacturer, ''),
        partNumber: first(device.partNumber, device.part_number, device.mpn, part.mpn, part.manufacturerPart, part.manufacturer_part, device.partId, device.part_id, ''),
        group: first(device.group, device.function, device.location, 'General'),
        width: finite(first(placement.width, dimensions.width, footprint.width, device.width, part.width), 40),
        height: finite(first(placement.height, dimensions.height, footprint.height, device.height, part.height), 30),
        depth: finite(first(dimensions.depth, footprint.depth, device.depth, part.depth), 50),
        x: finite(first(placement.x, device.x), plateSource.x ? finite(plateSource.x, 0) + 20 : 50),
        y: finite(first(placement.y, device.y), plateSource.y ? finite(plateSource.y, 0) + 20 : 50),
        rotation: finite(first(placement.rotation, device.rotation), 0),
        railId: first(placement.railId, placement.rail_id, device.railId, device.rail_id, null),
        terminals: terminalIds.map((terminal) => typeof terminal === 'string' ? { id: terminal } : terminal),
        mounting: first(device.mounting, part.mounting, 'DIN'),
        color: first(device.color, part.color, '#3b82f6'),
        assetId: first(device.assetId, device.source_asset_id, part.assetId, part.source_asset_id, null),
        source_asset_id: first(device.source_asset_id, device.assetId, part.source_asset_id, part.assetId, null),
        footprintRef: first(device.footprintRef, device.footprint_ref, part.footprintRef, part.footprint_ref, null),
        footprint_ref: first(device.footprint_ref, device.footprintRef, part.footprint_ref, part.footprintRef, null),
        metadata: { sourceEirId: deviceId, partId: first(device.partId, part.id, null) },
      };
    });
    const rails = first(enclosureSource.rails, source.rails, []) || [];
    const ducts = first(enclosureSource.ducts, source.ducts, []) || [];
    const connectionList = source.connections || source.nets || [];
    const connections = (Array.isArray(connectionList) ? connectionList : Object.values(connectionList || {})).map((connection, index) => ({
      id: idOf(connection, `connection-${index + 1}`),
      from: first(connection.from, connection.fromDevice, connection.from_device, connection.source, connection.sourceDevice, ''),
      to: first(connection.to, connection.toDevice, connection.to_device, connection.target, connection.targetDevice, ''),
      label: first(connection.label, connection.net, connection.netName, connection.potential, ''),
      kind: first(connection.kind, connection.type, 'wire'),
    }));
    return {
      schemaVersion: source.schemaVersion || source.schema_version || source.version || 'eir-0.1',
      units: 'mm',
      project: { id: source.project?.id || source.projectId || source.project_id || source.id || 'eir-project', name: source.project?.name || source.name || 'EIR panel', revision: source.project?.revision || source.revision || 'A' },
      enclosure: { id: enclosureSource.id || 'enclosure-main', name: enclosureSource.name || 'Control cabinet', width, height, depth: finite(enclosureSource.depth, 300) },
      mountingPlate: { id: plateSource.id || 'plate-main', x: finite(plateSource.x, finite(enclosureSource.plate_margin, 40)), y: finite(plateSource.y, finite(enclosureSource.plate_margin, 40)), width: finite(first(plateSource.width, width - 2 * finite(enclosureSource.plate_margin, 40)), width - 80), height: finite(first(plateSource.height, height - 2 * finite(enclosureSource.plate_margin, 40)), height - 80) },
      rails: rails.map((rail, index) => ({ id: idOf(rail, `rail-${index + 1}`), type: rail.type || 'DIN-rail-35', x: finite(rail.x, 40), y: finite(rail.y, height - 120 - index * 120), length: finite(first(rail.length, rail.width, width - 80), width - 80), height: finite(first(rail.height, rail.width, 7.5), 7.5) })),
      ducts: ducts.map((duct, index) => ({ id: idOf(duct, `duct-${index + 1}`), x: finite(duct.x, 50), y: finite(duct.y, 50), width: finite(duct.width, 40), height: finite(duct.height, 120), orientation: duct.orientation || 'vertical' })),
      components,
      connections,
      metadata: { sourceSchema: source.schemaVersion || source.schema_version || source.version || 'unknown', adapter: 'eir-v1-to-panel-view-0.1' },
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { adapt };
  else global.CnbEirAdapter = { adapt };
}(typeof window !== 'undefined' ? window : globalThis));
