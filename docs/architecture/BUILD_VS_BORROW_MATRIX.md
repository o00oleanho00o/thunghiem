# R4.3 Build-vs-Borrow Matrix

This matrix is based on source inspection and executable checks performed on the
repositories listed in `OSS_EVALUATION_MANIFEST.md`. "Maturity" is a delivery
assessment for CNB integration, not a claim that an upstream project is
production-certified. CNB remains the source of engineering truth.

| Capability | CNB current implementation | OSS candidate | OSS maturity | Integration effort | Keep / Replace / Wrap / Reference |
|---|---|---|---|---|---|
| DXF parsing | Python `ezdxf` audits and export; browser has limited custom parsing | mlightcad data model/converter; ezdxf service | High for DXF, proven source census | M | Wrap mlightcad for browser review; keep ezdxf server audit |
| DXF rendering | Custom SVG/DXF rendering in `apps/web/cad-browser.js` and export package | `@mlightcad/three-renderer`, `@mlightcad/cad-simple-viewer` | High feature surface; browser bundle verified only partially in this spike | M | Replace viewer behind `CadViewerAdapter`; dual-run first |
| SVG rendering | Hand-authored SVG in `apps/web/cad-browser.js` | Cabinet `toSvg.ts`; sldeditor image/SVG export | Medium | S | Keep CNB artifact fallback; borrow OSS export where applicable |
| Zoom/pan | Custom browser viewport behavior | Fabric viewport in cabinet; Three camera in mlightcad; sldeditor viewport hooks | High | S | Replace generic CAD interactions |
| Selection | Custom component selection | mlightcad pickable scene metadata/spatial index; Fabric selection; sldeditor selection store | High | M | Replace generic selection, map IDs in adapter |
| Block handling | CNB exports simple rectangles and named blocks | mlightcad INSERT/block conversion and entity identity | High | M | Replace DXF block viewer path |
| Layers | Export-only layer labels | mlightcad layer/style manager and effective layer resolution | High | S | Replace viewer layer mechanics; CNB owns semantic layer policy |
| CAD editing | Limited component move/rotate in custom workbench | mlightcad commands/transforms; CodeCAD `cad_call` | Medium | L | Wrap only after edit/round-trip gate |
| Snapping | CNB grid/rail/duct snap in custom JS | Cabinet `align.ts`, `ductsnap.ts`; sldeditor connectable hit tests | High for panel/SLD, not generic mlightcad OSNAP evidence | M | Wrap cabinet snap; keep CNB engineering constraints |
| DIN rail | First-class CNB EIR rail and placement semantics | Cabinet has no rail collection; visual element proxy only | Low as OSS domain model | M | Keep CNB semantics; project locked visual proxy |
| Duct | First-class CNB duct model and clearance validation | Cabinet typed ducts, border snap, row spanning | High for 2D layout | S | Wrap cabinet duct model |
| Cabinet canvas | CNB custom workbench | Cabinet React 19 + Fabric.js editor | High for 2D panel workflow | L | Replace via `PanelLayoutAdapter`; do not copy UI yet |
| Placement | CNB heuristic/CP-SAT layout engine | Cabinet local reflow/row packing; no global electrical solver | Medium | M | Keep CNB solver; send placements to OSS editor |
| Collision | CNB `packages/validation` plus browser warnings | Cabinet `overlap.ts` and `validate.ts` | High for 2D AABB warnings | S | Use OSS editor validation as UX; CNB remains gate |
| Clearance | CNB engineering validation and duct clearance | Cabinet duct clearance warning | Medium | S | Keep CNB rule authority; mirror warnings |
| Auto-layout | CNB heuristic and optional OR-Tools CP-SAT | Cabinet row reflow/pack; sldeditor ELK-style compiler auto-layout | Medium | M | Keep CNB placement; borrow local reflow |
| DXF export | `packages/cad_export`, `apps/web/cad-browser.js`, ezdxf | Cabinet `service/dxf_build.py`; sldeditor `lib/export-dxf.ts` | High for 2D output | M | Wrap OSS exporters; retain CNB audit and provenance |
| Schematic editor | CNB topology adapter/model, no mature editor | sldeditor React SVG editor | High for SLD interaction | L | Replace future custom editor with adapter |
| Topology | EIR `Connection`, terminals and validation | sldeditor compiler/internal model, union-find | High | M | Keep EIR topology; map into sldeditor |
| Terminals | EIR terminal IDs and connection validation | sldeditor terminal layers and endpoint types | High for diagram endpoints | M | Wrap |
| Wiring diagrams | Custom SVG line preview only | sldeditor wire-path/auto-route; WireViz YAML harness docs | Medium/High by use case | L | sldeditor for SLD, WireViz adapter for harness docs |
| 3D | No CNB 3D cabinet | FreeCAD/Cables survey; PartCAD CAD engines; CodeCAD DWG/2D focus | Low for direct CNB fit | XL | Reference only in R4.3 |
| BOM | CNB catalog/BOM intelligence and CSV outputs | PartCAD assembly `get_bom*`; WireViz BOM | High generic, weak electrical identity semantics | M | Keep CNB BOM authority; optional PartCAD/WireViz projections |
| Product catalog | `packages/component_library`, verified catalog and source artifacts | PartCAD packages/projects/providers | Medium | L | Experiment behind `ProductCatalogAdapter`; do not replace core |
| Product provenance | EIR `ProvenanceValue`, `SourceArtifact`, hashes and verification statuses | PartCAD revision/file hashes and package locks | Medium/High infrastructure | M | Keep CNB field-level evidence; borrow package locking concepts |
| AI planning | `packages/ai_intent` structured intent parser | AI-CAD planner/design log and CodeCAD scriptable API | Medium/High pattern | M | Keep CNB orchestration; borrow loop/evidence patterns |
| AI tool calls | Typed intent to project builder, no geometry calls | AI-CAD deterministic tools; CodeCAD `cad_call` | High pattern, domain mismatch | M | Keep typed CNB tools; never expose primitive geometry |
| Validation | CNB schema, engineering rules, export audits | Cabinet model validation; AI-CAD spec/DFMA tools | High complementary | M | Keep CNB policy; compose OSS checks |
| ERP integration | Not implemented in OSS candidates | PartCAD providers/cart; no CNB ERP semantics | Low | XL | Keep/build CNB adapter boundary |

## Code-level findings

### Cabinet Layout Generator

`web/src/model/types.ts` defines a serializable model (`plate`, `ducts`,
`elements`, `groups`, `labels`, `library`) in millimetres with top-left
coordinates. `resolve.ts` reads dimensions from the library, while
`reflow.ts`, `align.ts`, and `ductsnap.ts` are pure placement helpers.
`overlap.ts` and `validate.ts` deliberately flag overlap, clearance, row overflow,
and off-plate conditions instead of silently coercing them. `FabricStage.tsx`
binds Fabric.js to that model and sends move events back; it does not own truth.
`service/app.py` exposes stateless upload/export endpoints and `dxf_build.py`
assembles named equipment blocks with ezdxf. The test suite covers model geometry,
reflow, snapping, overlap, validation, and SVG rendering (62 tests passed).

The model has ducts but no DIN rail or connection collection. The POC therefore
projects rails as locked visual rectangles and records connections as unsupported
metadata. This is a safe adapter boundary, not a reason to pretend it is a full
electrical cabinet model.

Direct answers for the panel decision:

1. It is good enough to replace the generic 2D workbench mechanics, but not the
   CNB electrical model or global placement solver.
2. The data model is clean and serializable; Fabric.js is explicitly a view
   binding, which makes an adapter practical.
3. Equipment DXF upload is a FastAPI endpoint that measures the file, keeps a
   block/SVG reference, and adds a library item for the editor/exporter.
4. Rails are not first-class and duct logic is reusable; rail semantics stay in
   CNB and are projected as locked proxies in the POC.
5. Auto-layout is local row reflow/packing, not a topology-aware cabinet solver.
6. Validation is useful for AABB overlap, duct clearance, row overflow, and
   off-plate warnings, but CNB policy remains authoritative.
7. Export quality is the strongest integration point: the stateless ezdxf service
   emits named blocks and layers from the same JSON model.
8. Tests cover geometry, snapping, reflow, overlap, validation, and SVG; upstream
   activity must still be monitored.
9. A thin adapter is lower maintenance than a fork. Fork only if rail support or
   a required export change cannot be isolated.

### mlightcad

The monorepo separates data/model, `cad-simple-viewer`, and `three-renderer`.
The renderer converts entities into Three.js scene objects, tracks entity identity
and effective layer (including layer-0 inheritance through INSERT), and provides
camera/viewport conversion, pickable metadata, batching, and an RBush spatial
index. `AcApDocManager` opens documents and explicitly leaves DWG converter
registration to the host. DXF is the safe default path; the optional LibreDWG
worker is GPL-3.0 and the private DWG converter is commercial. Three real CNB DXFs
were parsed and censused; the browser simple-viewer package and its dependency
chain built, but the complete example workspace did not reach a clean build.

Direct answers for the DXF decision: mlightcad should be the primary DXF viewer
candidate and embeds naturally in React because the published package exposes a
viewer plus Three.js renderer. Entity identity, layer metadata, INSERT/block
handling, selection/picking, view transforms, and spatial queries are accessible
at the package boundary. The source census covers LINE, LWPOLYLINE, CIRCLE, HATCH,
TEXT, MTEXT, and INSERT classes seen in CNB assets. This is a stronger path than
the current SVG-only renderer, but browser performance must still be measured on
the 546-entity G120C and larger future drawings. Use it for source-CAD review,
layer toggles, block/entity inspection, and view extraction; keep export/audit in a
CNB service. Use only the MIT DXF portion until a DWG license is approved.

### sldeditor

`src/model/types.ts`, `src/compiler/internal-model.ts`, `compile.ts`, and the
Zustand `store/store.ts` separate document state from rendering. The store has
elements, buses, junctions, wires, annotations, selection, undo, and wire-path
updates. `auto-route.ts` and `wire-path.ts` provide orthogonal routing; canvas
layers render terminals, buses, junctions, and wires. `lib/export-dxf.ts` and
`lib/export-image.ts` provide deterministic exports. The library contains breaker,
PLC-adjacent, busbar, transformer, and other electrical symbols. Build and 256
tests passed; one element-library test suite failed before execution because an
upstream parser cannot parse an em dash in a comment.

Direct answers for the schematic decision: the topology-first model and compiler
can map EIR devices, terminals, and nets without coupling panel coordinates to
diagram coordinates. Symbols are JSON-backed and extensible; terminal, busbar,
junction, and wire endpoint semantics are explicit. Orthogonal auto-routing and
manual routes are generic enough for a first SLD adapter, and SVG/PNG/DXF exports
are present. The library is therefore worth using instead of building a second
schematic editor, with the QElectroTech symbol attribution notice carried through
the distribution.

### PartCAD

PartCAD's Python core models `Project`, `Shape`, `Part`, and `Assembly`, resolves
package files and external repositories, supports multiple CAD factories, caches
artifacts, and exposes plugin/provider interfaces. `Assembly.get_bom*` walks the
assembly tree and can return grouped, detailed, or supply BOMs. Revision and file
hash mechanisms make fetched artifacts reproducible, and the AI agent package
ships installable skills. This is a useful package/assembly substrate, but its
shape-first abstraction does not provide CNB's manufacturer identity, terminal
semantics, field-level verification, or panel clearance policy. Use it only behind
an adapter after a small catalog experiment.

PartCAD answers, explicitly:

1. Use it as an optional product/CAD package substrate, not as the CNB product
   truth layer.
2. `ProductIdentity` can map to a PartCAD package/part name, metadata, source URL,
   and revision, but the mapping must retain the canonical CNB ID and order code.
3. It has useful package locks, revisions, file hashes, and provider metadata, but
   not enough CNB field-level verification statuses or electrical terminal evidence
   by itself.
4. Assembly traversal and `get_bom*` are useful for generic subassemblies; an
   electrical cabinet's device tags, terminals, DIN rail, clearance, and sourcing
   rules need a CNB projection, so the BOM is complementary rather than canonical.
5. Borrow package boundaries, external-source pinning, artifact hashes, provider
   plugins, and grouped/detailed BOM traversal.
6. Making PartCAD core now would add CAD-engine/runtime, async assembly, provider,
   and package-version complexity before CNB has a proven catalog use case.

### AI-CAD and CodeCAD

AI-CAD puts planner, designer, deterministic CadQuery executor, renderer,
dimension checker, spec validator, and DFMA evaluator behind a filesystem evidence
tree. Proposal code is rendered and scored before promotion, with regression
rollback. CodeCAD exposes a typed `cad_call` dispatcher over a Rust/WASM document
model, with optional server-side scripting and CRDT sync. Both reinforce the CNB
rule that AI emits intent or typed operations, while deterministic engines own
geometry and validation.

### Optional references

QElectroTech provides mature electrical project/sheet/element conventions and an
XML format, but is a GPLv2 desktop application. Its element collection carries
separate CC-BY attribution. WireViz is a text/YAML-to-GraphViz harness tool with
connector, pin, wire, autoroute, SVG/PNG, and BOM output; it is GPL-3.0 and is not a
complete system wiring model. FreeCAD/Cables remains a 3D and manufacturing
survey item only.
