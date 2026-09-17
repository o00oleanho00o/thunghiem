# OSS Evaluation Manifest

Evaluation date: 2026-09-17. All repositories below were cloned under
`research/cloned-or-scripted-spikes/`; they are research inputs, not runtime
dependencies. Commits are pinned so the conclusions are reproducible.

| Repo | URL | Commit | License | Evaluated / run | POC result | Decision |
|---|---|---|---|---|---|---|
| Cabinet Layout Generator | https://github.com/Taam4142/cabinet-layout-generator | `0633b013dc65d13055b8f3765a27425cb58ec510` | MIT | `npm ci --ignore-scripts`; `npm test -- --run`; `npm run build` | PASS: 62/62 tests, build, CNB EIR adapter/export | Adopt through panel adapter; dual-run before replacement |
| mlightcad/cad-viewer | https://github.com/mlightcad/cad-viewer | `44cfd514b2d0c56346034f49b499b65c53ed2a70` | MIT core; optional GPL/proprietary DWG | `pnpm install --frozen-lockfile`; simple-viewer dependency/build | PARTIAL: simple-viewer chain builds; full example build blocked by workspace declaration/order and plugin pnpm check; 3 DXFs parsed | Primary DXF viewer candidate, DXF-only initially |
| sldeditor | https://github.com/NovaShang/sldeditor | `c03dff4d2dbb928d2e22db31e0615167cb582e4c` | MIT plus CC-BY QET symbols | `npm ci --ignore-scripts`; `npm run build:lib`; `npm test -- --run` | PARTIAL: library build and 256 tests; one element-library suite fails before execution on upstream em-dash parser syntax | Later schematic adapter; no custom editor |
| PartCAD | https://github.com/partcad/partcad | `2a1326ba3a99063bfa62a58c70bee4a48aa47a00` | Apache-2.0 | Source/code review; package/assembly/BOM/provider inspection | REVIEW: no CNB runtime POC in R4.3 | Catalog/package experiment only |
| AI-CAD | https://github.com/ai-cad-labs/ai-cad | `c7503b4febd3bfa3368c1df38adb187eeb375fd7` | Apache-2.0 | Tool-layer, planner, validator, DFMA/evidence source review | REVIEW | Borrow typed tool and repair/evidence patterns |
| CodeCAD | https://github.com/backkem/codecad | `c578b7375d875d5dc1994fb40165c798c1d19e0c` | MIT | Rust/WASM API and server architecture review | REVIEW | Reference for typed CAD calls; no dependency |
| WireViz | https://github.com/wireviz/WireViz | `e4fe099f8c7b86736aee7b4227cc794b6e8b36f0` | GPL-3.0 | YAML model, GraphViz renderer, BOM source review | REVIEW | Optional external harness adapter only |
| QElectroTech source | https://github.com/qelectrotech/qelectrotech-source-mirror | `395c6f66029e68cfe64027cbdccf725bf3edbb13` | GPLv2 | Project/sheet/XML/domain convention review | REVIEW | Domain reference; no embed |
| QElectroTech elements | https://github.com/qelectrotech/qelectrotech-elements | `429b4bf092965834f3c8190dc8767aa416ef2c90` | Collection-specific CC-BY obligations | Element metadata/attribution review | REVIEW | Separate asset/reference surface |

## Commands and evidence

POC 1 was run from the CNB repository root:

```text
python experiments/oss/cabinet_layout_adapter.py
```

It loaded `examples/plc-panel/project.json`, mapped 9 devices, 2 rails, and 3
ducts, called the OSS ezdxf exporter, and produced a valid 29-entity DXF and SVG.
Rails are recorded as locked visual proxies; connections remain in EIR because
the OSS layout model has no topology collection.

POC 2 was run as:

```text
python experiments/oss/mlightcad_dxf_poc.py
```

It parsed KTP700 (13 entities, 420 x 297), G120C (546 entities, approximately
677.6 x 349.25), and SITOP (38 entities, approximately 279.4 x 431.8) with ezdxf
using the same DXF entity families exercised by mlightcad. This is source-ready
and reproducible, but not a browser screenshot/runtime acceptance: the complete
mlightcad example build was blocked as noted above. That limitation is carried
into the final decision and Phase A gate.
