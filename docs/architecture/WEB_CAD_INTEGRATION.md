# Web CAD Integration Contract

The web editor is a thin projection of the canonical Electrical Intermediate
Representation (EIR). It does not persist SVG nodes or canvas coordinates as a
second source of truth.

## Boundary

`apps/web/eir-adapter.js` maps the Python EIR v1 collections into the browser
panel view model:

| EIR source | Browser field | Rule |
| --- | --- | --- |
| `enclosure.width/height/depth` | `enclosure` | millimetres; default only when absent |
| `enclosure.plate` | `mountingPlate` | explicit plate bounds |
| `parts[]` / `partDefinitions[]` | part lookup | part id plus `manufacturer_part`/MPN resolve footprint/material |
| `devices[]` | `components[]` | stable `id`, `device_id`, tag, `part_id` and function are preserved |
| `placements[]` | component `x/y/rotation/railId` | `device_id`/`rail_id` join by stable device id |
| `device.terminals[]` / `terminal_ids[]` | component `terminals[]` | terminal-level semantics are retained |
| `connections[]` | `connections[]` | snake_case `from_device` / `to_device` become endpoint ids |
| `rails[]`, `ducts[]` | physical guides | geometry remains in millimetres |

The adapter is one-way for rendering. Exported JSON is the normalized EIR
projection (`schemaVersion`, `units: mm`, stable component ids); a production
API should merge placement edits back into the authoritative EIR with a
version/concurrency check rather than accepting arbitrary SVG edits.

## CAD boundary

`packages/cad-export` is dependency-free JavaScript used by both the browser
and the Node API. It emits deterministic ASCII DXF R12 (`AC1009`) with layers
for enclosure, mounting plate, DIN rail, duct, component, tag, terminal and
wire. SVG is a preview representation only. `scripts/audit_dxf.cjs` parses the
DXF group-code stream independently and `scripts/render_dxf.cjs` renders that
parsed stream back to SVG, proving the export is not just a renamed image.

## Known prototype limit

The browser currently edits a normalized panel projection. It supports 5 mm
grid movement, nearest-rail snapping for DIN devices, and middle-mouse/Alt-drag
viewport panning, but it does not yet round-trip a changed component footprint
or topology into the Python EIR API; that merge belongs in the next integration
slice. The stable IDs and explicit mapping make this boundary testable (see
`scripts/test_eir_adapter.cjs` and `scripts/test_web_api.cjs`).

The shell also has a mobile layout mode: at 390 px it stacks the canvas,
library, and inspector vertically without body-width overflow. The evidence
probe is `evidence/screenshots/05-panel-mobile.png`.
