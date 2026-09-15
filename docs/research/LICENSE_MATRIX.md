# License matrix and commercial-use boundary

This is an engineering triage document, not legal advice. It records the license signals visible in the repositories on 2026-09-15 and the integration posture we should use until counsel confirms a distribution model. A repository's top-level SPDX badge is not enough for a symbol, STEP, font, model, or generated-data subdirectory.

## Decision rule

| Class | Examples in this study | Default posture for a proprietary CNB core |
|---|---|---|
| Permissive (MIT, BSD-2/3, Apache-2.0, ISC) | ezdxf, maker.js, xyflow, OR-Tools, dxf-parser, dxfjs/writer, shapely, networkx, CadQuery, CircuitVerse, Excalidraw | Candidate for vendoring/linking after NOTICE and dependency audit. Preserve copyright/license text and check transitive dependencies. |
| LGPL / weak copyleft | FreeCAD, OpenCascade.js, OCCT | Prefer a separate process or dynamically linked boundary; preserve notices and allow relinking where required. Confirm static/WASM bundling obligations with counsel. |
| EPL / mixed copyleft | ELKjs, Graphviz, Eclipse ELK, OpenEMS | Keep as a separately replaceable service/library boundary; inspect file-level notices and reciprocal terms before modifying/distributing. |
| GPL-family | QElectroTech, KiCad core, LibrePCB, LibreCAD/libdxfrw, xschem, SKiDL, OpenSCAD, FidoCadJ, logisim-evolution, OpenPLC editor, KLayout | Research, external CLI/process, or clean-room reimplementation. Do not link into a proprietary web/API core by default. |
| AGPL | xeokit, OpenEMS (one license option) | Treat network use as distribution risk; keep out of the core unless counsel explicitly approves. |
| Research/unclear or bundled assets | Text2CAD, CADFusion model/data terms, cad-recode, KiCad symbol/footprint/3D assets | Reference/benchmark only until the exact LICENSE and asset provenance are recorded. |

## Repository-level inventory

The full row-level values (including source status and risk) are in [REPO_MATRIX.csv](./REPO_MATRIX.csv). This table groups the same evidence to make an architectural decision quickly.

### Permissive candidates (low default integration risk)

| Repository | Stated license | What still needs checking |
|---|---|---|
| [NovaShang/sldeditor](https://github.com/NovaShang/sldeditor) | MIT | Dependency licenses; whether generated SVG contains third-party symbols. |
| [Taam4142/cabinet-layout-generator](https://github.com/Taam4142/cabinet-layout-generator) | MIT | Asset files and any embedded manufacturer drawings. |
| [mozman/ezdxf](https://github.com/mozman/ezdxf) | MIT | Python transitive dependencies and generated fonts/templates. |
| [arbaev/dxf-kit](https://github.com/arbaev/dxf-kit) | MIT | npm dependency tree and DXF parser coverage. |
| [wiscaksono/cadview](https://github.com/wiscaksono/cadview) | MIT | Browser dependencies and bundled fonts. |
| [gdsestimating/dxf-parser](https://github.com/gdsestimating/dxf-parser) | MIT | Lockfile and dependency notices; parent observed CI lock mismatch. |
| [dxfjs/writer](https://github.com/dxfjs/writer) | MIT | Peer dependency versions; parent observed install conflict. |
| [microsoft/maker.js](https://github.com/microsoft/maker.js) | Apache-2.0 | NOTICE and dependency licenses; parent build passed. |
| [CadQuery/cadquery](https://github.com/CadQuery/cadquery) | Apache-2.0 | OCCT/pythonocc linkage and binary redistribution model. |
| [google/or-tools](https://github.com/google/or-tools) | Apache-2.0 | Native solver binaries and language bindings in deployment images. |
| [xyflow/xyflow](https://github.com/xyflow/xyflow) | MIT | Pro packages or examples may have separate terms. |
| [dagrejs/dagre](https://github.com/dagrejs/dagre) | MIT | npm dependency tree. |
| [fabricjs/fabric.js](https://github.com/fabricjs/fabric.js) | MIT | Optional plugins and fonts. |
| [konvajs/konva](https://github.com/konvajs/konva) | MIT | npm dependency tree. |
| [paperjs/paper.js](https://github.com/paperjs/paper.js) | MIT | Build-time dependencies. |
| [mrdoob/three.js](https://github.com/mrdoob/three.js) | MIT | Examples/assets are not automatically MIT. |
| [CircuitVerse/CircuitVerse](https://github.com/CircuitVerse/CircuitVerse) | MIT | Ruby/npm dependencies and hosted-service terms. |
| [nturley/netlistsvg](https://github.com/nturley/netlistsvg) | MIT | Symbol templates and fonts in consuming app. |
| [cdelker/schemdraw](https://github.com/cdelker/schemdraw) | MIT | Font/rendering dependency terms. |
| [mph-/lcapy](https://github.com/mph-/lcapy) | MIT | SymPy/numpy dependency licensing. |
| [networkx/networkx](https://github.com/networkx/networkx) | BSD-3-Clause | Native/scientific stack licenses. |
| [secnot/rectpack](https://github.com/secnot/rectpack) | MIT | No known reciprocal term; still record version. |
| [shapely/shapely](https://github.com/shapely/shapely) | BSD-3-Clause | GEOS dependency (LGPL) and binary distribution. |
| [Toblerity/rtree](https://github.com/Toblerity/rtree) | MIT | libspatialindex native library license. |
| [d3/d3](https://github.com/d3/d3) | ISC | Individual d3 subpackages may differ; preserve notice. |
| [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) | MIT | Font/icon assets and optional hosted features. |
| [jgraph/drawio](https://github.com/jgraph/drawio) | Apache-2.0 | Included shape libraries/extensions may have own licenses. |
| [svgdotjs/svg.js](https://github.com/svgdotjs/svg.js) | MIT | Plugin licenses. |
| [microsoft/CADFusion](https://github.com/microsoft/CADFusion) | MIT shown on repo | Dataset/checkpoint terms must be checked separately; research status. |
| [rundiwu/DeepCAD](https://github.com/rundiwu/DeepCAD) | MIT | Dataset/model weights and papers may impose extra restrictions. |
| [dbhavery/textcad](https://github.com/dbhavery/textcad) | MIT | Tiny experimental code; no implied model/data rights. |
| [ai-cad-labs/ai-cad](https://github.com/ai-cad-labs/ai-cad) | Apache-2.0 | Model/data provenance and dependencies. |
| [Open-Cascade-SAS/OCCT-samples](https://github.com/Open-Cascade-SAS/OCCT-samples) | LGPL-2.1 | OCCT and sample assets follow their own notices. |

### LGPL and process-boundary candidates

| Repository | Stated license | Recommended boundary |
|---|---|---|
| [FreeCAD/FreeCAD](https://github.com/FreeCAD/FreeCAD) | LGPL-2.1 | Optional worker/container for scripted STEP/DXF generation; avoid copying GUI/core into web bundle. |
| [donalffons/opencascade.js](https://github.com/donalffons/opencascade.js) | LGPL-2.1 | Separate WASM package with license/relocation notice; measure bundle size. |
| [Open-Cascade-SAS/OCCT](https://github.com/Open-Cascade-SAS/OCCT) | LGPL-2.1 | Native geometry service or dynamic library; document build flags and notices. |

### EPL / mixed-license candidates

| Repository | Stated license | Recommended boundary |
|---|---|---|
| [kieler/elkjs](https://github.com/kieler/elkjs) | EPL-2.0 | Isolate layout adapter/package; retain EPL notice and inspect generated artifacts. |
| [eclipse-elk/elk](https://github.com/eclipse-elk/elk) | EPL-2.0 | Same; useful server-side reference, not required in the browser core. |
| [graphviz/graphviz](https://github.com/graphviz/graphviz) | EPL-1.0 | Invoke as an external renderer or preserve exact source/library notices. |
| [OpenEMS/openEMS](https://github.com/openems/openems) | AGPL-3.0/EPL-2.0 | Not in MVP; isolate if future simulation is needed. |

### GPL-family references or external tools

| Repository | Stated license | Why we still study it | Default commercial posture |
|---|---|---|---|
| [qelectrotech/qelectrotech-source-mirror](https://github.com/qelectrotech/qelectrotech-source-mirror) | GPL-2.0 | Closest open electrical-CAD domain model. | External process/reference; no core linking. |
| [qelectrotech/qelectrotech-elements](https://github.com/qelectrotech/qelectrotech-elements) | GPL-2.0/verify files | Symbol/element metadata. | Import only after provenance review. |
| [KiCad/kicad-source-mirror](https://github.com/KiCad/kicad-source-mirror) | GPL-3.0 plus exceptions | Mature project/schematic/library architecture. | Study or process boundary. |
| [LibrePCB/LibrePCB](https://github.com/LibrePCB/LibrePCB) | GPL-3.0 | Clean UUID/library model. | Study or process boundary. |
| [FidoCadJ/FidoCadJ](https://github.com/FidoCadJ/FidoCadJ) | GPL-3.0 | Compact schematic persistence. | External/reference only. |
| [manufino/eSchema](https://github.com/manufino/eSchema) | GPL-3.0 | Web electrical UI experiment. | External/reference only. |
| [StefanSchippers/xschem](https://github.com/StefanSchippers/xschem) | GPL-2.0 | Hierarchical netlist semantics. | External/reference only. |
| [LibreCAD/LibreCAD](https://github.com/LibreCAD/LibreCAD) | GPL-2.0 | DXF UX and commands. | External/reference only. |
| [LibreCAD/libdxfrw](https://github.com/LibreCAD/libdxfrw) | GPL-2.0 | DXF/DWG implementation details. | Do not link into proprietary core by default. |
| [openscad/openscad](https://github.com/openscad/openscad) | GPL-2.0 | Text-to-CAD architecture. | Reference/process only. |
| [devbisme/skidl](https://github.com/devbisme/skidl) | GPL-3.0 | Programmatic netlist/topology. | Reference/process only. |
| [logisim-evolution/logisim-evolution](https://github.com/logisim-evolution/logisim-evolution) | GPL-3.0 | Interaction and connectivity concepts. | Reference only. |
| [circuitikz/circuitikz](https://github.com/circuitikz/circuitikz) | GPL-2.0 | Symbol rendering quality. | External batch renderer only. |
| [thiagoralves/OpenPLC_Editor](https://github.com/thiagoralves/OpenPLC_Editor) | GPL-3.0 | PLC workflow boundary. | Reference only. |
| [KLayout/klayout](https://github.com/KLayout/klayout) | GPL-2.0 | Robust geometry/selection. | Reference only. |
| [CGAL/cgal](https://github.com/CGAL/cgal) | GPL-3.0/commercial | Geometry predicates/algorithms. | Purchase commercial license or use permissive alternatives. |
| [OpenBoardView/OpenBoardView](https://github.com/OpenBoardView/OpenBoardView) | GPL-2.0 | Parser/viewer patterns. | Not relevant to core. |

## Data and manufacturer content warning

The following are not automatically safe to copy because they are data/content ecosystems rather than permissively licensed code: KiCad symbol/footprint/3D repositories, QElectroTech element files, manufacturer STEP files, EPLAN Data Portal exports, WSCAD Universe assets, CADENAS/TraceParts downloads, and any scraped product catalogue. For the lab, store only synthetic fixtures or links and record source/terms/attribution for every imported part.

## Recommended legal architecture

1. Keep the CNB EIR, validators, layout heuristics, API and renderer in new permissively licensed code.
2. Use MIT/Apache/BSD dependencies directly after an automated SBOM/license scan.
3. Keep GPL/EPL/LGPL components behind adapters or worker processes until counsel signs off on the exact static/dynamic/WASM distribution.
4. Treat component symbols, 2D footprints and STEP models as separately licensed data with provenance IDs; never infer a code license from a model download page.
5. Pin commit/tag plus SHA for every production dependency and preserve the dated evidence in this directory.
