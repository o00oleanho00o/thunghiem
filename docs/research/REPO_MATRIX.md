# Repository matrix

This is the auditable shortlist for the Electrical CAD lab. The machine-readable matrix is [REPO_MATRIX.csv](./REPO_MATRIX.csv); it has every required field from the mission. The table below is the human-readable index (65 repositories/projects, not a popularity ranking).

## Method and evidence

- Metadata was checked on 2026-09-15 (Asia/Saigon) from each public GitHub repository page and `https://github.com/<owner>/<repo>/commits.atom`. `stars` and `last_activity` are therefore a dated snapshot, not a product-quality score.
- License is the repository's displayed SPDX/notice where available. Library subdirectories and bundled symbol/3D assets can carry additional notices; the license matrix is deliberately conservative.
- `source/docs inspected` means README, build manifest and top-level source layout were examined. Practical run evidence from this overnight run is recorded in the notes and in the parent agent's test logs. `metadata/docs inspected` means no claim of a successful local build is made.
- Unknown capability means it was not established by this pass, not that the project cannot do it.
- Tier A = immediate reuse/spike candidate; B = high-value reference or adapter candidate; C = niche/research/reference; D = out of MVP or incompatible with the commercial core.

## Electrical schematic and libraries

| Repository | Stars | Updated | License | Tier | What evidence says | Reuse decision |
|---|---:|---|---|:---:|---|---|
| [qelectrotech/qelectrotech-source-mirror](https://github.com/qelectrotech/qelectrotech-source-mirror) | 546 | 2026-09-15 | GPL-2.0 | A | Qt/C++ electrical CAD application with domain objects, projects, elements and reports. | Learn/adapt file model; isolate GPL process or reimplement adapter. |
| [qelectrotech/qelectrotech-elements](https://github.com/qelectrotech/qelectrotech-elements) | 56 | 2026-09-14 | GPL-2.0 (verify per file) | B | XML element library, useful for symbol ingestion and pin metadata. | Import/reference only until per-file notices are checked. |
| [NovaShang/sldeditor](https://github.com/NovaShang/sldeditor) | 14 | 2026-09-13 | MIT | A | Browser SLD editor; parent smoke test reports build PASS and 256 tests pass with one library-build syntax failure. | Strong prototype adapter candidate; supplement with EIR and rules. |
| [KiCad/kicad-source-mirror](https://github.com/KiCad/kicad-source-mirror) | 3.0k | 2026-09-15 | GPL-3.0 plus exceptions | B | Mature C++ EDA, hierarchical schematic/netlist and library ecosystem. | Study model and formats; do not link GPL core into proprietary service by default. |
| [KiCad/kicad-symbols](https://github.com/KiCad/kicad-symbols) | 765 | 2020-10-02* | KiCad library terms | B | Large symbol corpus with pin/graphic metadata. | Seed importer after license/provenance review. |
| [KiCad/kicad-footprints](https://github.com/KiCad/kicad-footprints) | 688 | 2020-10-02* | KiCad library terms | C | PCB footprint geometry; no DIN/duct/terminal semantics. | Borrow dimensions only. |
| [KiCad/kicad-packages3D](https://github.com/KiCad/kicad-packages3D) | 511 | 2020-10-02* | KiCad library terms | C | STEP/VRML package models. | Optional 3D seed, per-file provenance required. |
| [LibrePCB/LibrePCB](https://github.com/LibrePCB/LibrePCB) | 3.0k | 2026-09-07 | GPL-3.0 | B | Project/library separation and explicit UUID-based objects are excellent model references. | Learn architecture; do not embed GPL application core. |
| [FidoCadJ/FidoCadJ](https://github.com/FidoCadJ/FidoCadJ) | 140 | 2026-09-01 | GPL-3.0 | C | Compact text schematic/vector format and desktop editor. | Format ideas only. |
| [manufino/eSchema](https://github.com/manufino/eSchema) | 4 | 2026-07-18 | GPL-3.0 | C | Small web electrical schematic experiment. | Inspect UX; maturity too low for dependency. |
| [StefanSchippers/xschem](https://github.com/StefanSchippers/xschem) | 493 | 2026-09-15 | GPL-2.0 | B | Hierarchy, symbols and net connectivity are explicit; Tcl/Tk desktop runtime. | Use as topology reference or external process. |
| [TinyTapeout/xschem-viewer](https://github.com/TinyTapeout/xschem-viewer) | 35 | 2025-12-14 | Apache-2.0 | C | Web viewer/export path for xschem plots. | Viewer pattern only; no editing semantics. |
| [devbisme/skidl](https://github.com/devbisme/skidl) | 1.7k | 2026-08-10 | GPL-3.0 | B | Python API builds netlists from component/pin connections. | Strong topology test oracle; isolate GPL. |
| [CircuitVerse/CircuitVerse](https://github.com/CircuitVerse/CircuitVerse) | 1.3k | 2026-09-10 | MIT | C | Browser circuit graph interaction and simulation. | Borrow connectivity UX, not device model. |
| [logisim-evolution/logisim-evolution](https://github.com/logisim-evolution/logisim-evolution) | 7.6k | 2026-09-15 | GPL-3.0 | C | Mature educational schematic interaction and simulation. | Study UX; domain/licensing mismatch. |
| [nturley/netlistsvg](https://github.com/nturley/netlistsvg) | 828 | 2024-01-25 | MIT | B | Deterministic netlist-to-SVG renderer with JSON-like gate data. | Reuse rendering ideas; add EIR/device links. |
| [cdelker/schemdraw](https://github.com/cdelker/schemdraw) | 265 | 2026-07-18 | MIT | B | Programmatic circuit symbol and wire drawing to SVG/PDF. | Useful deterministic schematic export. |
| [mph-/lcapy](https://github.com/mph-/lcapy) | 300 | 2026-08-16 | MIT | C | Symbolic circuit analysis and diagrams. | Future analysis boundary, not MVP. |
| [circuitikz/circuitikz](https://github.com/circuitikz/circuitikz) | 585 | 2026-09-12 | GPL-2.0 | C | High-quality TeX electrical symbols and connections. | Batch export reference; not interactive core. |
| [thiagoralves/OpenPLC_Editor](https://github.com/thiagoralves/OpenPLC_Editor) | 577 | 2025-11-06 | GPL-3.0 | C | IEC 61131-3 PLC programming/editor workflow. | Future PLC handoff reference only. |

## Panel, 2D CAD and DXF

| Repository | Stars | Updated | License | Tier | What evidence says | Reuse decision |
|---|---:|---|---|:---:|---|---|
| [Taam4142/cabinet-layout-generator](https://github.com/Taam4142/cabinet-layout-generator) | 0 | 2026-06-06 | MIT | A | Closest small-domain cabinet/DIN layout prototype; parent reports web build and 62 tests PASS. | Reuse concepts/fixtures; keep canonical EIR in lab. |
| [LibreCAD/LibreCAD](https://github.com/LibreCAD/LibreCAD) | 6.4k | 2026-09-15 | GPL-2.0 | B | Mature 2D CAD UI and DXF workflows. | External tool/process or UX study; no direct commercial link. |
| [LibreCAD/libdxfrw](https://github.com/LibreCAD/libdxfrw) | 293 | 2025-09-25 | GPL-2.0 | B | C++ DXF/DWG reader-writer implementation. | Parser behavior reference; copyleft linkage risk. |
| [mozman/ezdxf](https://github.com/mozman/ezdxf) | 1.4k | 2026-08-26 | MIT | A | Python DXF parser/writer/auditor; broad entity support and headless operation. | Preferred server-side export/audit candidate. |
| [arbaev/dxf-kit](https://github.com/arbaev/dxf-kit) | 44 | 2026-06-26 | MIT | B | Small TypeScript DXF toolkit. | Browser-side writer/parser spike candidate. |
| [wiscaksono/cadview](https://github.com/wiscaksono/cadview) | 10 | 2026-04-07 | MIT | C | Lightweight web CAD/DXF viewer. | Viewer experiment only; low adoption. |
| [gdsestimating/dxf-parser](https://github.com/gdsestimating/dxf-parser) | 556 | 2023-03-15 | MIT | B | JavaScript parser for common DXF entities. | Read/import candidate; parent saw lockfile mismatch in CI. |
| [dxfjs/writer](https://github.com/dxfjs/writer) | 125 | 2026-02-07 | MIT | B | Focused JS/TS DXF writer. | Export spike; parent saw peer dependency conflict. |
| [microsoft/maker.js](https://github.com/microsoft/maker.js) | 2.0k | 2026-08-25 | Apache-2.0 | A | Parametric 2D geometry, model composition and SVG/DXF export. Parent reports build PASS. | Good browser geometry layer, with EIR as source of truth. |
| [KLayout/klayout](https://github.com/KLayout/klayout) | 1.2k | 2026-08-26 | GPL-2.0 | C | Robust geometry/selection/layout engine for IC design. | Study spatial algorithms; wrong domain and license. |
| [OpenBoardView/OpenBoardView](https://github.com/OpenBoardView/OpenBoardView) | 1.8k | 2026-09-05 | GPL-2.0 | D | Boardview parser/viewer. | Not relevant to cabinet semantics. |

## Layout, geometry and routing

| Repository | Stars | Updated | License | Tier | What evidence says | Reuse decision |
|---|---:|---|---|:---:|---|---|
| [google/or-tools](https://github.com/google/or-tools) | 14.0k | 2026-06-09 | Apache-2.0 | A | CP-SAT, MIP and routing; maps directly to no-overlap, rail and clearance constraints. | Use as solver service or package; benchmark by zone/size. |
| [kieler/elkjs](https://github.com/kieler/elkjs) | 2.8k | 2026-09-09 | EPL-2.0 | A | Layered graph layout for schematic topology. Parent reports `npm ci` PASS; tests blocked by missing generated `lib/main.js`. | Use for schematic auto-layout after build artifact policy is fixed. |
| [xyflow/xyflow](https://github.com/xyflow/xyflow) | 38.4k | 2026-09-01 | MIT | A | Mature interactive node-edge UI with selection, handles and viewport. | Strong UI shell; domain/validation remains own code. |
| [graphviz/graphviz](https://github.com/graphviz/graphviz) | 12k | 2026-09-15 | EPL-1.0 | B | Deterministic graph layout/export (including orthogonal modes). | External renderer/reference, not cabinet solver. |
| [dagrejs/dagre](https://github.com/dagrejs/dagre) | 5.8k | 2026-08-08 | MIT | B | Browser directed graph layout. | Schematic prototype option; less constraint-aware than ELK. |
| [networkx/networkx](https://github.com/networkx/networkx) | 17.3k | 2026-09-12 | BSD-3-Clause | A | Graph algorithms and shortest paths. | Use for net/duct route graph; add geometric occupancy. |
| [secnot/rectpack](https://github.com/secnot/rectpack) | 563 | 2021-11-24 | MIT | B | Rectangle packing heuristics. | Baseline panel layout benchmark; stale activity. |
| [shapely/shapely](https://github.com/shapely/shapely) | 4.5k | 2026-09-15 | BSD-3-Clause | A | Robust planar predicates/intersection/clearance checks. | Use for deterministic validation and geometry tests. |
| [Toblerity/rtree](https://github.com/Toblerity/rtree) | 683 | 2026-09-15 | MIT | B | Spatial index for hit-testing and collision candidate queries. | Optional scale optimization; native dependency. |
| [CGAL/cgal](https://github.com/CGAL/cgal) | 6.0k | 2026-09-14 | GPL-3.0/commercial | C | High-quality computational geometry. | Use only after commercial licensing review. |

## 3D and web rendering

| Repository | Stars | Updated | License | Tier | What evidence says | Reuse decision |
|---|---:|---|---|:---:|---|---|
| [FreeCAD/FreeCAD](https://github.com/FreeCAD/FreeCAD) | 33.5k | 2026-09-15 | LGPL-2.1 | B | Parametric CAD kernel/UI and Python scripting; broad STEP/DXF ecosystem. | Server-side optional 3D/export worker; defer from P0. |
| [CadQuery/cadquery](https://github.com/CadQuery/cadquery) | 5.8k | 2026-09-13 | Apache-2.0 | B | Python parametric solid DSL; repeatable geometry generation. | Best scripted cabinet/rail 3D spike when needed. |
| [openscad/openscad](https://github.com/openscad/openscad) | 10.2k | 2026-09-12 | GPL-2.0 | C | Text-to-solid modeling and preview. | Architecture reference; GPL and weak electrical semantics. |
| [donalffons/opencascade.js](https://github.com/donalffons/opencascade.js) | 927 | 2023-03-27 | LGPL-2.1 | B | WebAssembly OpenCascade bindings. | Browser 3D proof point; stale activity/large WASM risk. |
| [Open-Cascade-SAS/OCCT](https://github.com/Open-Cascade-SAS/OCCT) | 2.9k | 2026-08-24 | LGPL-2.1 | B | Industrial geometry kernel and STEP/BREP basis. | Server worker or future 3D service; do not put in MVP path. |
| [Open-Cascade-SAS/OCCT-samples](https://github.com/Open-Cascade-SAS/OCCT-samples) | 3 | 2026-05-03 | LGPL-2.1 | C | Small sample programs. | Documentation/examples only. |
| [mrdoob/three.js](https://github.com/mrdoob/three.js) | 115.6k | 2026-09-15 | MIT | B | WebGL scene graph and interaction. | Optional viewport renderer, not a CAD kernel. |
| [xeokit/xeokit-sdk](https://github.com/xeokit/xeokit-sdk) | 932 | 2026-09-08 | AGPL-3.0 | C | Web BIM/3D viewer. | Viewer reference; AGPL makes core embedding risky. |

## AI/CAD research

| Repository | Stars | Updated | License | Tier | What evidence says | Reuse decision |
|---|---:|---|---|:---:|---|---|
| [SadilKhan/Text2CAD](https://github.com/SadilKhan/Text2CAD) | 473 | 2025-05-15 | Research/verify | C | Text-to-CAD model/data research; compute and dataset heavy. | Learn representation; never let it emit authoritative DXF directly. |
| [microsoft/CADFusion](https://github.com/microsoft/CADFusion) | 91 | 2025-07-08 | MIT | C | Multimodal CAD generation research. | Pattern reference for intent-to-structure, not runtime dependency. |
| [rundiwu/DeepCAD](https://github.com/rundiwu/DeepCAD) | 823 | 2024-04-12 | MIT | C | Autoregressive CAD sequence generation. | Benchmark/reference only; no electrical constraints. |
| [filaPro/cad-recode](https://github.com/filaPro/cad-recode) | 261 | 2025-11-16 | Research/verify | C | CAD program reconstruction/representation research. | Explore historical drawing learning; verify license before data use. |
| [dbhavery/textcad](https://github.com/dbhavery/textcad) | 0 | 2026-07-25 | MIT | D | Tiny natural-language CAD experiment. | Do not depend on it. |
| [ai-cad-labs/ai-cad](https://github.com/ai-cad-labs/ai-cad) | 4 | 2026-08-09 | Apache-2.0 | C | Early agentic CAD experiments. | Interface ideas only. |

## Canvas and diagram infrastructure

| Repository | Stars | Updated | License | Tier | What evidence says | Reuse decision |
|---|---:|---|---|:---:|---|---|
| [fabricjs/fabric.js](https://github.com/fabricjs/fabric.js) | 31.4k | 2026-09-13 | MIT | B | Object canvas, transforms, selection and SVG serialization. | UI interaction layer candidate; EIR remains canonical. |
| [konvajs/konva](https://github.com/konvajs/konva) | 14.8k | 2026-09-13 | MIT | B | Fast 2D scene graph and event model. | Canvas option for 100+ component panel. |
| [paperjs/paper.js](https://github.com/paperjs/paper.js) | 15.1k | 2024-07-17 | MIT | C | Path/vector operations. | Geometry helper, not complete CAD UX. |
| [d3/d3](https://github.com/d3/d3) | 113.7k | 2026-05-28 | ISC | C | Data-driven SVG and scales. | Use overlays/metrics only. |
| [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) | 132.0k | 2026-09-15 | MIT | C | Undo/selection/collaboration UX. | Precision/unit model is insufficient for core. |
| [jgraph/drawio](https://github.com/jgraph/drawio) | 8.1k | 2026-09-08 | Apache-2.0 | C | Diagram editor and shape libraries. | Workflow reference; no electrical semantics. |
| [svgdotjs/svg.js](https://github.com/svgdotjs/svg.js) | 11.8k | 2026-08-04 | MIT | C | Lightweight SVG manipulation. | Rendering utility only. |

\* The three KiCad library repositories expose an old mirror timestamp in their commit feed; inspect upstream release/library tags before relying on that date.

## Practical deep-dive index (20+)

The following received source/build/manifest review rather than only a landing-page scan: QElectroTech source/elements, sldeditor, KiCad source, LibrePCB, xschem, cabinet-layout-generator, ezdxf, dxf-parser, dxfjs/writer, maker.js, FreeCAD, CadQuery, OpenCascade.js, OR-Tools, ELKjs, xyflow, Text2CAD, CADFusion, DeepCAD and SKiDL. Parent-run smoke evidence is explicitly called out above; unresolved blockers are preserved rather than silently upgraded to "works".

## Important negative findings

1. No surveyed open-source project combines terminal-level electrical topology, manufacturer part/footprint data, DIN/duct constraints, panel placement, and audited DXF output under a permissive license.
2. The most domain-complete projects (QElectroTech, KiCad, LibrePCB, xschem, SKiDL) are GPL-family or desktop/library-oriented; they are excellent references but not drop-in commercial web cores.
3. DXF libraries solve serialization, not engineering truth. A valid DXF can still contain duplicate tags, impossible rail mounts, overlapping footprints or dangling nets.
4. AI-CAD research emits geometry/program tokens or solids, not a validated electrical intermediate representation. The proposed product must keep AI at intent/specification level.
