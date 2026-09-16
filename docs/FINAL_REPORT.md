# Final Report

## Executive conclusion

**GO WITH CONDITIONS** for a narrowly scoped product experiment: **BOM or
structured intent -> panel layout -> validated JSON/SVG/DXF with schematic
links**. The mission did not establish that a small team can replace EPLAN,
WSCAD or native DWG workflows. It did establish, with runnable evidence, that
the engineering core is technically feasible and that the open-source
ecosystem is composable rather than vertically complete.

The hypothesis survived because three independent checks held at once:

- a versioned semantic EIR stayed stable through layout, schematic projection,
  serialization and export;
- heuristic and CP-SAT layouts handled synthetic 2-, 10- and 32-motor cases
  containing 13, 61 and 193 components with zero reported validation errors or
  overlap pairs (heuristic roughly 2.3/7.6/32 ms; bounded solver roughly
  25/1033/1127 ms in the captured run). CP-SAT proved optimal only for the
  13-part case and returned a feasible result for 61 and 193 parts;
- generated DXF opened and rendered independently with `ezdxf` as AC1009/R12,
  with measured 800 x 2000 mm bounds.

The conditions are material: real vendor data/provenance, production-grade
round-trip API, clearance/routing depth, and validation with permitted customer
drawings are still unproven.

## What was built and tested

| Requirement | Evidence |
|---|---|
| Canonical domain model | `packages/domain_model`, `eir.v1`, stable IDs, explicit mm units, 20 Python tests |
| Component catalog | 11 synthetic generic part definitions with terminals, ratings, footprints and mounting metadata |
| Three panel scenarios | `examples/{starter-panel,mcc-6-motor,plc-panel}/project.json` |
| Heuristic layout | deterministic grouping, rail binning, duct corridors and capacity-aware rows |
| Solver spike | OR-Tools CP-SAT no-overlap, bounds, rail baselines, locked placements and connection-distance objective |
| Headless validation | E001-E011 issue model; collision/outside/rail/duct/tag/topology checks |
| Schematic spike | `evidence/schematic/*.json`; every node retains `device_id`; `link_device` test |
| AI spike | strict `DesignIntent`, mock parser, unknown-part/schema rejection; no coordinates emitted by provider |
| CAD output | canonical JSON, SVG and ASCII DXF R12 from the same Python EIR |
| Independent DXF audit | `scripts/audit_dxf_ezdxf.py`, `scripts/render_dxf_ezdxf.py`, PNG evidence |
| Web editor | `apps/web`, real browser screenshots, add/select/move/auto-layout/export actions, raw-EIR API contract test |
| External OSS experiments | 24 shallow clones; 65-row research matrix; 8+ practical package/build/test runs |

The current core test evidence is `evidence/test-logs/pytest.log`: **20 tests
passed**. Benchmark numbers come from
`evidence/test-logs/layout_benchmark.json`; they are single captured Windows
runs over synthetic fixtures, not statistically stable performance claims.

The browser evidence deliberately includes both a clean result and a mutation
that creates two validation issues. That is stronger than a screenshot showing
only a happy path: `web-ui-evidence.json` records auto-layout `issues=0`, then
manual add/move `issues=2` with the inspector visible.

## Build/borrow map

```text
Schematic editor       -> own EIR adapter; evaluate MIT sldeditor for UI
Topology engine         -> own terminal-level graph; study xschem/KiCad/SKiDL
Panel canvas            -> own thin view; borrow cabinet-layout-generator/xyflow patterns
DXF parser/audit        -> ezdxf (MIT) server-side, independent audit required
DXF writer              -> deterministic own subset; optionally wrap ezdxf/maker.js
Auto layout             -> own domain heuristic + OR-Tools CP-SAT by zone
Routing                 -> own duct occupancy graph + NetworkX/A* baseline
3D                      -> defer full BREP; same EIR to bounding boxes/STEP later
AI intent parser        -> own provider interface + strict schema
Component DB            -> own normalized schema and provenance ledger
```

## Top repositories worth using

1. `mozman/ezdxf` (MIT): server-side DXF read/write/audit; independent audit passed.
2. `google/or-tools` (Apache-2.0): CP-SAT and routing primitives; benchmark passed.
3. `NovaShang/sldeditor` (MIT): browser SLD interaction; build passed and 256 tests passed, with one source syntax failure in a library-build suite.
4. `Taam4142/cabinet-layout-generator` (MIT): closest cabinet/DIN reference; web build and 62 tests passed.
5. `microsoft/maker.js` (Apache-2.0): parametric 2D composition/export; build passed.
6. `xyflow/xyflow` (MIT): mature node-edge viewport/selection patterns; not an electrical model.
7. `kieler/elkjs` (EPL-2.0/GPL option): schematic graph layout candidate; source test needs generated `lib/main.js`.
8. `gdsestimating/dxf-parser` (MIT): browser DXF import candidate; lockfile mismatch blocked clean `npm ci` in this snapshot.
9. `dxfjs/writer` (MIT): focused TS writer candidate; peer dependency conflict blocked clean install.
10. `CadQuery/cadquery` (Apache-2.0): later server-side 3D parametric path, not MVP.

The full 65-row matrix, license posture and 20+ deep-dive notes are in
`docs/research/REPO_MATRIX.{csv,md}`, `LICENSE_MATRIX.md` and
`OPEN_SOURCE_LANDSCAPE.md`.

## Repositories to study but not embed by default

QElectroTech, KiCad, LibrePCB, xschem, LibreCAD/libdxfrw, FreeCAD/OpenCascade,
OpenSCAD and SKiDL contain valuable models or algorithms but have GPL/LGPL or
process-boundary implications. They remain excellent references or external
tools until legal review and deployment/linkage decisions are explicit. Vendor
symbol/STEP/catalog assets are data licenses, not automatically covered by the
code license.

## Architecture decision

Use a Python engineering service with Pydantic EIR, normalized catalog,
headless validation, OR-Tools and ezdxf, fronted by a web editor that projects
the same EIR. Keep SVG/DXF/JSON deterministic. Use AI only before catalog
resolution and never let it emit raw geometry. Defer full 3D and native DWG.
Details: `docs/architecture/RECOMMENDED_ARCHITECTURE.md`.

## Falsification and residual risk

The experiment found and fixed two genuine layout defects: a midpoint duct
collision and overflow rails overlapping a terminal row. This is important
evidence that deterministic validation can falsify an attractive layout. The
remaining risks are more consequential than UI polish:

- browser edits now have an explicit EIR adapter and export path, but a
  transactional merge-back API is still next work;
- clearance rules are basic and do not model thermal, EMC, bend radius,
  accessibility or manufacturer-specific mounting behavior;
- routing is represented by connection lines, not duct-occupied wire paths and
  manufacturing lengths;
- synthetic parts do not prove vendor catalog acquisition or field accuracy;
- 193 components is a synthetic stress case. It exceeds the mission's
  approximately 100-component measurement target, but is not production-scale
  proof; the two larger CP-SAT results were feasible within the time bound, not
  proven globally optimal;
- DXF R12 is a useful interchange, not native DWG or a complete manufacturing
  contract.

## Verdict

**GO WITH CONDITIONS**, with the first commercial experiment limited to one
manufacturer-neutral, BOM-driven panel workflow and human review. Do not fund
a broad "AI electrical CAD replacement" claim yet. Advance only through the
90-day gates in `docs/NEXT_90_DAYS.md`; stop or redirect if permitted customer
drawings cannot be normalized or if engineers reject the generated handoff.
# R3 checkpoint

R3.1b closes the engineering-truth correction pass with eight ABB S200 U type designations, eight distinct manufacturer order codes, a byte-verified official source artifact, explicit layout warnings and separate manufacturing-release blockers. It proves an engineering-layout-grade truth pipeline, not manufacturing readiness. See `docs/r3/R3_1_TRUTH_CLOSURE_REPORT.md`.

R3.1b replaces the authoritative slice with eight ABB S201U type designations and eight distinct manufacturer order codes backed by one cached official PDF artifact and field-level page locators. See `docs/r3/R3_1_TRUTH_CLOSURE_REPORT.md`.
