# Rebuilds REPO_MATRIX.csv from the audited catalog below.  Values are intentionally
# conservative: `unknown` means the capability was not established by this run.
$raw = @'
qelectrotech/qelectrotech-source-mirror|electrical-schematic|Qt desktop electrical CAD core|546|2026-09-15|C++|GPL-2.0|A|schematic;topology;component_library|Source mirror; strong domain semantics but desktop/Qt integration.
qelectrotech/qelectrotech-elements|electrical-library|QElectroTech symbol/element library|56|2026-09-14|XML|GPL-2.0|B|schematic;component_library|Element XML is useful as an import source; verify per-file headers.
NovaShang/sldeditor|electrical-schematic|Browser single-line diagram editor|14|2026-09-13|JavaScript|MIT|A|SVG;schematic;topology|Build and tests observed by parent agent; narrow SLD scope.
KiCad/kicad-source-mirror|electrical-schematic|Full open-source PCB/EDA application|3.0k|2026-09-15|C++|GPL-3.0|B|schematic;topology;component_library;SVG;PDF|Excellent model/reference; GPL core makes direct embedding unsuitable.
KiCad/kicad-symbols|electrical-library|KiCad symbol library|765|2020-10-02|KiCad symbols|KiCad library terms|B|schematic;component_library|Use as import/reference after license review; repository activity timestamp is mirror metadata.
KiCad/kicad-footprints|electrical-library|PCB footprint library|688|2020-10-02|KiCad footprint|KiCad library terms|C|component_library|Useful footprint dimensions; not cabinet/DIN semantics.
KiCad/kicad-packages3D|3d-library|KiCad STEP/VRML package models|511|2020-10-02|3D assets|KiCad library terms|C|3D;component_library|Model provenance and redistribution terms need per-file checks.
LibrePCB/LibrePCB|electrical-schematic|Modern project-based EDA|3.0k|2026-09-07|C++/Qt|GPL-3.0|B|schematic;topology;component_library;SVG;PDF|Good library/project separation; desktop GPL application.
FidoCadJ/FidoCadJ|electrical-schematic|Lightweight schematic/vector editor|140|2026-09-01|Java|GPL-3.0|C|schematic;SVG;PDF|Simple textual format; not a panel model.
manufino/eSchema|electrical-schematic|Web electrical schematic prototype|4|2026-07-18|JavaScript|GPL-3.0|C|schematic;SVG|Small/experimental; inspect for ideas only.
StefanSchippers/xschem|electrical-schematic|Hierarchical schematic capture|493|2026-09-15|C|GPL-2.0|B|schematic;topology;component_library|Mature net connectivity; Tcl/Tk desktop assumptions.
TinyTapeout/xschem-viewer|electrical-schematic|Web viewer for xschem plots|35|2025-12-14|TypeScript|Apache-2.0|C|schematic;SVG;browser|Viewer, not an editor or panel engine.
Taam4142/cabinet-layout-generator|panel-layout|DIN rail/cabinet layout generator experiment|0|2026-06-06|Python|MIT|A|panel_layout;component_library|Domain-aligned prototype; parent smoke test build/tests pass.
LibreCAD/LibreCAD|2d-cad|Desktop 2D CAD application|6.4k|2026-09-15|C++/Qt|GPL-2.0|B|DXF;SVG;PDF|Useful UX and DXF behavior; not a domain model.
LibreCAD/libdxfrw|2d-cad|DXF/DWG reader-writer library|293|2025-09-25|C++|GPL-2.0|B|DXF;DWG|Strong parser reference but copyleft linkage risk.
mozman/ezdxf|2d-cad|Python DXF parser/writer/auditor|1.4k|2026-08-26|Python|MIT|A|DXF;SVG|Best server-side DXF audit/export candidate; no editor.
arbaev/dxf-kit|2d-cad|TypeScript DXF parser/writer toolkit|44|2026-06-26|TypeScript|MIT|B|DXF;browser|Small API; validate coverage against required entities.
wiscaksono/cadview|2d-cad|Web CAD/DXF viewer|10|2026-04-07|JavaScript|MIT|C|DXF;browser;SVG|Low adoption; useful viewer experiment only.
gdsestimating/dxf-parser|2d-cad|JavaScript DXF parser|556|2023-03-15|JavaScript|MIT|B|DXF;browser|Read-only parser; parent observed lockfile CI mismatch.
dxfjs/writer|2d-cad|JavaScript DXF writer|125|2026-02-07|TypeScript|MIT|B|DXF;browser|Focused writer; parent observed peer dependency conflict.
microsoft/maker.js|2d-cad|Parametric 2D geometry and SVG/DXF export|2.0k|2026-08-25|TypeScript|Apache-2.0|A|DXF;SVG;browser|Good geometry primitives and model composition; parent build PASS.
FreeCAD/FreeCAD|3d-cad|Parametric desktop CAD kernel/UI|33.5k|2026-09-15|C++/Python|LGPL-2.1|B|DXF;SVG;PDF;3D|Powerful reference/server scripting; GUI/kernel deployment complexity.
FreeCAD/FreeCAD-documentation|3d-cad|FreeCAD technical documentation|104|2025-01-15|Markdown|CC0-1.0|C|3D|Documentation/reference only.
CadQuery/cadquery|3d-cad|Python parametric CAD DSL|5.8k|2026-09-13|Python|Apache-2.0|B|3D;DXF;SVG|Strong scripted 3D path; not browser-native.
openscad/openscad|3d-cad|Scripted solid modeling language/app|10.2k|2026-09-12|C++|GPL-2.0|C|3D;SVG|Excellent code-generation reference; GPL and limited electrical semantics.
donalffons/opencascade.js|3d-cad|WebAssembly OpenCascade bindings|927|2023-03-27|C++/TypeScript|LGPL-2.1|B|3D;browser|Browser BREP proof point; stale upstream activity and large WASM footprint.
Open-Cascade-SAS/OCCT|3d-cad|Open Cascade geometry kernel|2.9k|2026-08-24|C++|LGPL-2.1|B|3D;STEP|Kernel reference; browser adaptation is non-trivial.
google/or-tools|optimization|CP-SAT/MIP/routing optimization toolkit|14.0k|2026-06-09|C++/Python|Apache-2.0|A|routing;panel_layout|Use for placement/routing constraints; parent prototype target.
kieler/elkjs|layout|Layered graph layout in JavaScript|2.8k|2026-09-09|TypeScript|EPL-2.0|A|routing;SVG;browser|Excellent schematic auto-layout; parent npm install PASS, generated-lib test blocker.
xyflow/xyflow|layout|Interactive node-edge graph editor|38.4k|2026-09-01|TypeScript|MIT|A|routing;SVG;browser|UI interaction and selection patterns; not an electrical semantic model.
SadilKhan/Text2CAD|ai-cad|Text-to-parametric CAD research|473|2025-05-15|Python|Research license/verify|C|3D;AI|Research architecture only; model/data/compute heavy.
microsoft/CADFusion|ai-cad|Text/image/shape CAD generation research|91|2025-07-08|Python|MIT|C|3D;AI|Useful multimodal pattern; not production geometry kernel.
rundiwu/DeepCAD|ai-cad|Autoregressive CAD sequence generation|823|2024-04-12|Python|MIT|C|3D;AI|Research benchmark; no electrical constraints.
filaPro/cad-recode|ai-cad|CAD program reconstruction research|261|2025-11-16|Python|Research license/verify|C|3D;AI|Interesting representation learning; integration effort high.
dbhavery/textcad|ai-cad|Natural language to CAD experiment|0|2026-07-25|Python|MIT|D|3D;AI|Tiny/experimental; do not depend on it.
ai-cad-labs/ai-cad|ai-cad|AI CAD workflow experiments|4|2026-08-09|Python|Apache-2.0|C|3D;AI|Early research; inspect patterns, not core dependency.
graphviz/graphviz|graph-layout|Graph layout/rendering engine|12k|2026-09-15|C|EPL-1.0|B|routing;SVG;PDF|Useful topology visualization; orthogonal cabinet routing still custom.
dagrejs/dagre|graph-layout|Directed graph layout JavaScript|5.8k|2026-08-08|JavaScript|MIT|B|routing;SVG;browser|Simple browser graph layout; limited constraint semantics.
fabricjs/fabric.js|canvas|Interactive object canvas|31.4k|2026-09-13|TypeScript|MIT|B|SVG;browser|Selection/transforms; geometry source-of-truth must remain EIR.
konvajs/konva|canvas|High-performance 2D canvas scene graph|14.8k|2026-09-13|TypeScript|MIT|B|SVG;browser|Good interaction layer; no DXF/domain semantics.
paperjs/paper.js|canvas|Vector graphics scripting framework|15.1k|2024-07-17|TypeScript|MIT|C|SVG;browser|Useful path operations; less suitable for CAD hit-testing at scale.
mrdoob/three.js|3d-web|WebGL/3D rendering engine|115.6k|2026-09-15|JavaScript|MIT|B|3D;browser|Optional 3D viewport; not CAD kernel.
xeokit/xeokit-sdk|3d-web|Web IFC/3D model viewer|932|2026-09-08|TypeScript|AGPL-3.0|C|3D;browser|AGPL risk for proprietary SaaS; viewer only.
devbisme/skidl|electrical-schematic|Python schematic/netlist generation|1.7k|2026-08-10|Python|GPL-3.0|B|schematic;topology;component_library|Strong programmatic topology; GPL core and no panel geometry.
CircuitVerse/CircuitVerse|electrical-schematic|Browser digital circuit simulator|1.3k|2026-09-10|Ruby/TypeScript|MIT|C|schematic;topology;browser|Connectivity UX reference; not industrial CAD.
logisim-evolution/logisim-evolution|electrical-schematic|Digital logic schematic simulator|7.6k|2026-09-15|Java|GPL-3.0|C|schematic;topology|Good interaction ideas; wrong device/physical domain.
nturley/netlistsvg|electrical-schematic|Netlist to SVG schematic renderer|828|2024-01-25|JavaScript|MIT|B|schematic;topology;SVG|Deterministic renderer reference; no editing/layout constraints.
cdelker/schemdraw|electrical-schematic|Python programmatic circuit diagrams|265|2026-07-18|Python|MIT|B|schematic;SVG;PDF|Good deterministic output; not interactive CAD.
mph-/lcapy|electrical-analysis|Symbolic circuit analysis and diagrams|300|2026-08-16|Python|MIT|C|schematic;topology;SVG|Analysis reference; outside MVP scope.
networkx/networkx|graph|Python graph algorithms|17.3k|2026-09-12|Python|BSD-3-Clause|A|routing;topology|Use for net/duct graph prototypes; geometry and constraints custom.
secnot/rectpack|packing|2D rectangle packing algorithms|563|2021-11-24|Python|MIT|B|panel_layout|Baseline packing heuristic; stale activity and no electrical rules.
shapely/shapely|geometry|Robust planar geometry predicates|4.5k|2026-09-15|Python|BSD-3-Clause|A|panel_layout;DXF|Use for collision/clearance validation; no renderer.
Toblerity/rtree|geometry|Spatial index over libspatialindex|683|2026-09-15|Python|MIT|B|panel_layout|Useful hit-testing/index; native dependency.
d3/d3|visualization|Data-driven SVG/visualization primitives|113.7k|2026-05-28|JavaScript|ISC|C|SVG;browser|Charts/overlays; not a CAD interaction model.
excalidraw/excalidraw|canvas|Collaborative whiteboard editor|132.0k|2026-09-15|TypeScript|MIT|C|SVG;browser|Undo/selection UX ideas; lacks precision/units.
jgraph/drawio|diagram|General diagram editor|8.1k|2026-09-08|JavaScript|Apache-2.0|C|SVG;PDF;browser|Workflow/shape library reference; electrical semantics absent.
svgdotjs/svg.js|canvas|Lightweight SVG manipulation|11.8k|2026-08-04|TypeScript|MIT|C|SVG;browser|Small renderer utility; no CAD persistence.
thiagoralves/OpenPLC_Editor|plc|IEC 61131-3 PLC editor|577|2025-11-06|Python|GPL-3.0|C|schematic;topology|PLC workflow reference; copyleft and different domain.
OpenEMS/openEMS|simulation|Electromagnetic simulation suite|1.6k|2026-09-08|C++/Matlab|AGPL-3.0;EPL-2.0|D|3D|Out of MVP scope; useful only for future physics boundary.
circuitikz/circuitikz|electrical-schematic|LaTeX circuit drawing package|585|2026-09-12|TeX|GPL-2.0|C|schematic;SVG;PDF|High-quality symbol rendering; batch document output only.
KLayout/klayout|2d-cad|IC layout editor and geometry engine|1.2k|2026-08-26|C++/Ruby|GPL-2.0|C|SVG;DXF;browser|Geometry/selection reference; semiconductor domain and GPL.
CGAL/cgal|geometry|Computational geometry algorithms|6.0k|2026-09-14|C++|GPL-3.0/commercial|C|panel_layout;3D|Robust algorithms; commercial licensing needed for proprietary linkage.
OpenBoardView/OpenBoardView|2d-cad|Boardview file viewer|1.8k|2026-09-05|C++|GPL-2.0|D|browser|Not cabinet CAD; niche parser reference.
eclipse-elk/elk|layout|Eclipse Layout Kernel|373|2026-08-05|Java|EPL-2.0|B|routing;SVG|Server-side layered layout reference; Java integration.
Open-Cascade-SAS/OCCT-samples|3d-cad|OpenCascade sample applications|3|2026-05-03|C++|LGPL-2.1|C|3D|Examples only; kernel integration burden remains.
'@
$raw = "repo|category|purpose|stars|last_activity|language|license|tier|capabilities|notes`n" + $raw
$entries = $raw | ConvertFrom-Csv -Delimiter '|'
$columns = @('repo','category','purpose','stars','last_activity','language','license','maturity','build_status','test_status','data_model_quality','browser_ready','server_ready','DXF','DWG','SVG','PDF','3D','schematic','topology','panel_layout','routing','component_library','AI','integration_effort','commercial_license_risk','what_to_reuse','what_to_learn','why_not_use','tier','notes')
$rows = foreach($e in $entries) {
  $cap = @($e.capabilities -split ';')
  $isDeep = @('qelectrotech/qelectrotech-source-mirror','NovaShang/sldeditor','LibrePCB/LibrePCB','StefanSchippers/xschem','Taam4142/cabinet-layout-generator','mozman/ezdxf','gdsestimating/dxf-parser','dxfjs/writer','microsoft/maker.js','google/or-tools','kieler/elkjs','xyflow/xyflow','FreeCAD/FreeCAD','CadQuery/cadquery','donalffons/opencascade.js','SadilKhan/Text2CAD','microsoft/CADFusion','rundiwu/DeepCAD','devbisme/skidl') -contains $e.repo
  $o = [ordered]@{}
  foreach($c in $columns){$o[$c]='unknown'}
  $o.repo=$e.repo; $o.category=$e.category; $o.purpose=$e.purpose; $o.stars=$e.stars; $o.last_activity=$e.last_activity; $o.language=$e.language; $o.license=$e.license; $o.maturity=if($e.tier -eq 'A'){'production-adjacent'}elseif($e.tier -eq 'B'){'mature/reference'}else{'research/niche'}; $o.build_status=if($isDeep){'source/docs inspected'}else{'metadata/docs inspected'}; $o.test_status='not run in this docs pass'; $o.data_model_quality=if($e.category -match 'schematic|electrical|panel|3d-cad'){ 'domain model present; verify scope' }else{'generic geometry/graph model'}; $o.browser_ready=if($cap -contains 'browser'){'yes'}else{'no/adapter'}; $o.server_ready=if($e.language -match 'Python|C\+\+|Java'){ 'yes/adapter' }else{'yes'}; foreach($c in @('DXF','DWG','SVG','PDF','3D','schematic','topology','panel_layout','routing','component_library','AI')){$o[$c]=if($cap -contains $c){'yes'}else{'unknown'}}; $o.integration_effort=if($e.tier -eq 'A'){'M'}elseif($e.tier -eq 'B'){'M-H'}else{'H'}; $o.commercial_license_risk=if($e.license -match 'GPL|AGPL|EPL|commercial|verify'){'review / copyleft or provenance'}elseif($e.license -match 'LGPL'){'review dynamic/linking'}else{'low'}; $o.what_to_reuse=$e.purpose; $o.what_to_learn=$e.notes; $o.why_not_use=if($e.tier -eq 'A'){'Still requires domain adapter and deterministic validation'}else{'Scope, license, or maturity mismatch for core'}; $o.tier=$e.tier; $o.notes="Checked 2026-09-15 via GitHub page/commits.atom; $($e.notes)"; [pscustomobject]$o
}
$out = Join-Path $PSScriptRoot 'REPO_MATRIX.csv'
$rows | Select-Object $columns | Export-Csv -Path $out -NoTypeInformation -Encoding utf8
Write-Host "Wrote $($rows.Count) rows to $out"
