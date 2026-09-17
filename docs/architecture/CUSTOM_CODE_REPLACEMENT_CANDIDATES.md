# Custom Code Replacement Candidates

These are candidates for reduction, not deletions in R4.3. Each change must pass
the dual-run and feature-parity gates in `R4_3_OSS_DECISION.md`. Existing CNB
domain and validation code is intentionally excluded from generic CAD replacement.

| Current module | OSS replacement | Benefit | Risk | Migration difficulty | Decision |
|---|---|---|---|---|---|
| `apps/web/cad-browser.js` SVG geometry and component canvas | Cabinet Layout Generator model/render/export; mlightcad viewer for source DXF | Removes duplicate coordinate conversion, viewport, and primitive rendering | OSS model lacks rails/connections; visual fidelity may differ | High | Wrap and dual-run; retire generic renderer only after parity |
| `apps/web/cad-browser.js` zoom/pan/selection/drag mechanics | Cabinet Fabric stage for panel; mlightcad Three viewport for DXF | Mature hit testing, viewport transforms, and interaction | Adapter event/ID mapping; bundle size | Medium | Replace behind adapters |
| `packages/cad_export/index.js` generic rectangle/line DXF writer | Cabinet `service/dxf_build.py` or mlightcad export path | Better block/layer/ezdxf handling and one OSS model-to-export path | Service/runtime dependency; provenance hooks need reattachment | Medium | Wrap exporter, keep CNB audit |
| `packages/cad_export/exporter.py` duplicate DXF/SVG assembly | OSS exporter selected by artifact type | Less geometry drift between browser and fabrication output | Output conventions and title blocks need comparison | Medium | Keep as fallback until parity |
| `packages/layout_engine/engine.py` local row packing | Cabinet `reflow.ts`, `rows.ts`, `align.ts` | Tested editor-local reflow and snapping | OSS does not understand EIR topology or all constraints | Low | Borrow through `PanelLayoutAdapter`; retain global CNB solver |
| Browser overlap/clearance presentation | Cabinet `overlap.ts` / `validate.ts` | Consistent warn-but-allow UX with tests | Different tolerance/coordinate conventions | Low | Replace presentation, CNB remains validation authority |
| Any future generic block editor | mlightcad entity/block/INSERT model and commands | Avoids a second block graph and layer engine | API is broad and still changing | High | Do not build; gate mlightcad adoption |
| Any future standalone schematic renderer | sldeditor canvas/compiler/store/export | Electrical symbols, terminals, buses, junctions, orthogonal wires already exist | EIR mapping and symbol licensing | High | Do not build; use adapter in later milestone |
| Generic harness diagram renderer | WireViz adapter | YAML versionability, autoroute, SVG/PNG/BOM | GPL-3.0 and harness scope only | Medium | Optional external process; no core dependency |
| Generic product/CAD package registry | PartCAD package/project/provider concepts | Reproducible external sources and assembly BOM traversal | Shape-first model does not capture ProductIdentity/evidence | High | Experiment only behind catalog adapter |

## Explicitly retained CNB code

The following must not be replaced by a drawing library: EIR schemas and
canonical JSON; ProductIdentity and ManufacturerPart resolution; field-level
provenance and source hashes; engineering rules and validation policy; cabinet
candidate selection; BOM intelligence; approval state; AI intent orchestration;
and ERP adapters. OSS coordinates and geometry are projections of these records,
never the reverse source of truth.

## Deletion gate

An old module can be removed only when (1) the same EIR produces equivalent
placements and artifact audits in old and new paths, (2) real Siemens DXF assets
meet a documented entity/bounds/render gate, (3) locked rails, provenance, and
validation findings survive a round trip, (4) performance and bundle budgets are
recorded, and (5) rollback to the old adapter remains possible for one release.
