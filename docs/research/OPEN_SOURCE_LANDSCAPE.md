# Open-source electrical CAD landscape

## Executive finding

The ecosystem is rich in *pieces* but has no permissively licensed, web-first project that owns the whole chain `intent -> terminal topology -> manufacturer part -> DIN/duct panel placement -> validation -> audited DXF`. The mission hypothesis survives a hostile search only as a composition strategy. It does not survive as a "pick one existing CAD repo and add an LLM" strategy.

The strongest evidence is the mismatch between repository families:

```text
Electrical semantics:  QElectroTech / KiCad / LibrePCB / xschem / SKiDL
2D serialization:      ezdxf / dxf-kit / dxf-parser / dxfjs / libdxfrw
2D interaction:        maker.js / xyflow / fabric / Konva / SVG.js
Panel placement:       cabinet-layout-generator / rectpack / OR-Tools
Graph layout/routing:  ELKjs / Graphviz / dagre / NetworkX
3D geometry:           OCCT / FreeCAD / CadQuery / OpenCascade.js / three.js
AI-CAD research:       Text2CAD / CADFusion / DeepCAD / cad-recode
```

No vertical overlap covers all rows. The missing object is an Electrical Intermediate Representation (EIR) that links logical device, terminals, manufacturer part, symbol, footprint, placement, rules and representations without making drawing geometry the source of truth.

## Ecosystem map

### 1. Schematic and netlist engines

QElectroTech is the closest vocabulary match for industrial electrical drawings: projects/pages, elements, terminals, conductors, reports and an element library. Its GPL-2.0 Qt/C++ application is valuable to reverse-engineer but expensive to embed in a web product. The source mirror and element repository are active in the dated snapshot (2026-09-15 and 2026-09-14 respectively), so this is not merely historical code.

KiCad, LibrePCB and xschem provide stronger evidence for persistent identity, hierarchy and connectivity than small browser demos. KiCad's source is GPL-3.0 with exceptions; LibrePCB is GPL-3.0; xschem is GPL-2.0. Their data models are excellent references for stable IDs, symbol-library indirection, pin/net relationships and separate drawings, but they target PCB/IC/desktop workflows rather than cabinet mounting and manufacturer part selection.

`sldeditor` is a useful counterexample: a small MIT browser editor can deliver an SLD interaction quickly, but its domain is intentionally narrow. Parent smoke evidence was a successful build and 256 passing tests, with one library-build syntax failure. This supports an adapter strategy, not a claim that SLD is a complete ECAD model.

SKiDL is valuable because it makes topology executable: component/pin/net relationships can be generated and checked without drawing. Its GPL-3.0 license prevents assuming it can be linked into a proprietary core. `netlistsvg` and `schemdraw` show a clean deterministic path from structured connectivity to SVG/PDF, but neither stores panel placement or manufacturer data.

### 2. Panel and physical layout

`Taam4142/cabinet-layout-generator` is the rare repository aligned with cabinet/DIN layout. It is tiny (0 stars in the captured snapshot), MIT, and experimental, but parent smoke evidence reports a web build and 62 tests passing. That combination is more relevant to the wedge than a much larger generic CAD project. It still lacks a complete electrical topology, manufacturer catalog, constraint taxonomy and audited DXF pipeline; treat it as a fixture/concept source.

`rectpack` supplies rectangle-packing baselines. It has not had a recent commit in the dated snapshot (2021-11-24), so it is suitable as a deterministic benchmark, not a strategic dependency. OR-Tools CP-SAT and routing are the best foundation for hard constraints, while Shapely and Rtree make collision/clearance checks deterministic and testable. A hybrid heuristic plus solver is more credible than trying to make a generic graph layout engine understand DIN rails.

### 3. DXF and 2D CAD

`ezdxf` is the strongest permissive server-side candidate: MIT, Python, active, parser/writer/auditor and headless-friendly. `dxf-kit`, `dxf-parser` and `dxfjs/writer` cover browser/TypeScript alternatives but are smaller or narrower. Parent tests found a lockfile mismatch in `dxf-parser` and a peer dependency conflict in `dxfjs/writer`; these are practical maintenance signals, not reasons to claim they do not work.

`maker.js` (Apache-2.0) provides useful parametric geometry composition and SVG/DXF export, and its build passed in the parent smoke run. It is a geometry layer, not an electrical data model. LibreCAD/libdxfrw has mature format behavior but GPL-2.0. The safe conclusion is: own a deterministic projection from EIR to DXF, use a permissive writer/auditor, and test opening the output independently.

### 4. Browser interaction and rendering

xyflow offers the most mature node-edge editing behavior for schematic/topology views. Fabric.js and Konva provide object/scene interaction; SVG.js and D3 provide lightweight rendering; three.js is the optional 3D viewport. None should become the canonical model. Every one has a geometry-first temptation that would reproduce the very data-integrity problem the mission is meant to avoid.

ELKjs, dagre and Graphviz can lay out schematic graphs. ELKjs is the best browser-oriented layered graph candidate, but parent smoke testing found `npm ci` succeeds while its test command expects a generated `lib/main.js` artifact that is absent in a source checkout. This is a reproducible build-policy issue; pin a release package or build generated artifacts before depending on it.

### 5. 3D and parametric geometry

OCCT/FreeCAD/CadQuery prove that a server-side or worker-based 3D path is technically feasible. OpenCascade.js proves browser WASM is possible but carries a large bundle and stale upstream snapshot (last commit in the captured page: 2023-03-27). Three.js can display bounding boxes and STEP-converted meshes but is not a BREP kernel. For an SME wedge, 2D mounting plate plus optional 3D bounding-box/STEP view is a better risk profile than embedding a full browser BREP editor.

### 6. AI-CAD research

Text2CAD, CADFusion, DeepCAD, cad-recode, textcad and ai-cad demonstrate active research in text/image/program-to-CAD generation. They mostly emit token sequences, scripts or solids and require data/model/compute pipelines. None provides terminal-level electrical semantics, manufacturer constraints, serviceability rules or deterministic validation. The falsifiable design conclusion is to make AI produce a versioned `DesignSpec`/EIR proposal, then reject invalid references/dimensions before any layout or export. A raw geometry/DXF generator is not an acceptable source of truth.

## Deep-dive evidence ledger

| Area | Repositories inspected | What was actually learned | Limitation / blocker |
|---|---|---|---|
| Electrical CAD domain | QElectroTech source/elements; KiCad; LibrePCB; xschem | Semantics are separated into project/page, symbol/library, pins/terminals, nets and drawing records. Stable IDs and library indirection recur. | GPL-family/desktop assumptions; no shared panel model. |
| SLD web editing | sldeditor | Small MIT web editor can be built/tested; SLD topology and SVG rendering are approachable. | Narrow model; parent found one library-build syntax failure. |
| Panel layout | cabinet-layout-generator; rectpack | DIN/rail/rectangle grouping is a tractable domain-specific wedge; deterministic packing is easy to benchmark. | No full manufacturer/terminal/routing semantics. |
| DXF export | ezdxf; dxf-kit; dxf-parser; dxfjs/writer; maker.js; libdxfrw | Serialization and audit are solved enough; multiple viable language stacks. | Dependency freshness/lockfiles and license differ; DXF does not validate engineering. |
| Graph layout | ELKjs; dagre; Graphviz; xyflow; NetworkX | Schematic topology can use established graph algorithms and interaction patterns. | Cabinet routing requires occupancy, ducts, clearance and wire metadata. |
| Constraint solve | OR-Tools; Shapely; Rtree; rectpack | No-overlap/inside/clearance plus objective functions map naturally to CP-SAT + geometry predicates. | Need domain-specific decomposition to keep 100-part solve practical. |
| Parametric 3D | FreeCAD; CadQuery; OCCT; OpenCascade.js; three.js | Same domain placement can project to 2D and simple 3D; server-side kernels are more practical than browser BREP. | Native/WASM size and license boundaries. |
| AI CAD | Text2CAD; CADFusion; DeepCAD; cad-recode; textcad; ai-cad | Research confirms structured/program representations are more controllable than raw pixels. | No electrical truth, no production validation, compute/data cost. |
| Component libraries | KiCad libs; QElectroTech elements; STEP ecosystems | Symbol and footprint data are often separable assets with explicit provenance. | Manufacturer/catalog terms are not implied by OSS code license. |

## What a canonical EIR must contain

The repeated model seams across the ecosystem imply these stable layers:

```text
Project / document / sheet
  -> Function / location / installation / enclosure / zone
  -> Logical device and stable device tag
  -> Terminal/pin/potential/net/connection
  -> Manufacturer part and catalog provenance
  -> Symbol representation (schematic)
  -> Footprint + mounting/clearance/keep-out representation (panel)
  -> Placement/orientation/rail/duct assignment
  -> Rules, validation issues and generated representations (SVG/PDF/DXF/3D)
```

Semantics, topology, geometry and placement must be separate records. A `Breaker` can have one logical identity, multiple symbol instances, one or more manufacturer parts, a panel footprint and an optional 3D model; changing a coordinate must not alter the netlist or BOM.

## Gaps that require new engineering

1. **Cross-representation identity:** no surveyed project gives a permissively licensed, web-ready link from schematic device to physical panel instance and BOM item.
2. **Manufacturer data normalization:** symbol pins, MPNs, dimensions, mounting, thermal data, accessories and STEP provenance are fragmented across portals and license regimes.
3. **Cabinet constraints:** DIN rail compatibility, duct fill, high/low-voltage separation, terminal accessibility, service clearance and reserve space are absent from generic CAD/graph libraries.
4. **Deterministic validation:** a CAD file can render while electrical/topological/physical constraints are wrong; validation must be headless and independent of UI.
5. **Wire routing and manufacturing handoff:** graph shortest paths are not enough; routes need duct occupancy, bend/terminal metadata, labels and wire-length outputs.
6. **Change propagation:** editing a part, tag or footprint should update schematic, BOM, panel, labels and DXF without duplicating state.
7. **Historical-learning boundary:** project history can learn preferred grouping/spacing, but learned suggestions must be proposals scored by deterministic rules.

## Falsification tests implied by the landscape

The idea should be rejected if any of these fail repeatedly:

- EIR-to-SVG/DXF output cannot round-trip with stable IDs and units.
- A 30-part panel cannot satisfy no-overlap/rail/clearance rules within a practical solve time.
- A schematic click cannot resolve the exact panel instance and BOM item.
- A malformed AI `DesignSpec` can bypass schema/rule validation and reach the renderer.
- Imported DXF geometry cannot be isolated from semantics without silently inventing connectivity.
- License/provenance cannot be pinned for every code dependency and component asset.

The parent engineering agents are implementing these tests. This landscape report intentionally does not call the product "GO" on the basis of repository popularity.

## Source snapshot and reproducibility

Run `pwsh docs/research/generate_repo_matrix.ps1` from `cnb-electrical-lab` to regenerate the CSV catalog. The script uses the dated repository metadata captured in its input and sets unknown capability fields conservatively. Parent smoke commands and generated artifacts should be linked from the final report under `evidence/`.
