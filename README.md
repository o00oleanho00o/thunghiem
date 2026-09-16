# CNB Electrical CAD Lab

Evidence-driven R&D prototype for a small, web-first electrical control-cabinet workflow. The lab is an independent repository and does not import, modify, or depend on `cnberp`.

The tested vertical slice is:

```text
structured BOM / prompt
  -> versioned EIR (eir.v1)
  -> normalized component catalog
  -> heuristic or bounded OR-Tools layout
  -> deterministic validation
  -> schematic topology projection
  -> canonical JSON + SVG + audited ASCII DXF
```

The engineering principle is: **AI proposes intent; the domain model stores truth; rules validate; the solver arranges; the renderer draws; an engineer reviews.**

## Quick start

From `cnb-electrical-lab` on Windows PowerShell:

```powershell
py -3.10 -m venv .venv
.\\.venv\\Scripts\\python.exe -m pip install -r requirements.txt
$env:PYTHONPATH = (Get-Location).Path
.\\.venv\\Scripts\\python.exe -m pytest
.\\.venv\\Scripts\\python.exe examples/run_core_demo.py
node scripts/test_cad_export.cjs
node scripts/test_eir_adapter.cjs
node scripts/test_web_api.cjs
```

The demo writes the three scenarios (`starter-panel`, `mcc-6-motor`,
`plc-panel`) to `examples/` and `evidence/`. It also writes a synthetic
2/10/32-motor layout benchmark (13/61/193 components). In the captured run,
CP-SAT was optimal for 13 parts and feasible within the configured time bound
for 61 and 193; these are one-machine spike measurements, not production
performance guarantees.

## Web editor

```powershell
node apps/web/server.js 4173
```

Open <http://127.0.0.1:4173/>. The browser surface supports scenario loading,
component-library add/drag, selection and typed property edits, snap-grid
movement, auto-layout, validation, BOM inspection, and JSON/SVG/DXF downloads.
The browser model is an explicit projection from Python EIR v1 in
`apps/web/eir-adapter.js`; it is not a second canonical database.

To reproduce browser evidence with local Chrome:

```powershell
$env:CNB_WEB_URL = 'http://127.0.0.1:4173/'
node scripts/capture_web_evidence.cjs
```

The script records UI state in `evidence/test-logs/web-ui-evidence.json` and
captures real browser screenshots in `evidence/screenshots/`.

## DXF audit and independent render

```powershell
node scripts/generate_cad_evidence.cjs
node scripts/audit_dxf.cjs evidence/generated-dxf/mcc-6-motor/mcc-6-motor.dxf
.\\.venv\\Scripts\\python.exe scripts/audit_dxf_ezdxf.py evidence/generated-dxf/mcc-6-motor/mcc-6-motor.dxf
.\\.venv\\Scripts\\python.exe scripts/render_dxf_ezdxf.py evidence/generated-dxf/mcc-6-motor/mcc-6-motor.dxf evidence/screenshots/04-dxf-roundtrip-render.png
```

The `ezdxf` commands are intentionally independent of the lab writer. The
canonical Python EIR export opened as AC1009/R12 with 274 entities, bounds
800 x 2000 mm, and layers for enclosure, plate, rails, ducts, devices, tags,
part references and wires.

To rerun the complete non-interactive verification suite, use:

```powershell
.\scripts\release_gate.ps1
```

## Repository map

- `packages/domain_model/`: versioned EIR, units, stable IDs and serialization.
- `packages/component_library/`: normalized catalog and synthetic seed parts.
- `packages/layout_engine/`: transparent heuristic plus CP-SAT spike.
- `packages/validation/`: headless issue codes E001-E011.
- `packages/schematic_adapter/`: topology-first schematic projection and device linking.
- `packages/ai_intent/`: strict structured-intent boundary and mock provider.
- `packages/cad_export/`: Python SVG/DXF writer and audit.
- `packages/cad-export/`: browser JavaScript CAD projection/export.
- `apps/web/`: dependency-light panel editor and HTTP export API.
- `docs/research/`: 65-row, 31-column OSS matrix, licenses, landscape and commercial benchmark.
- `evidence/`: generated JSON, SVG, DXF, audit logs, benchmark data, schematic JSON and screenshots.
- `docs/DEFINITION_OF_DONE.md`: acceptance checklist mapping every mission item to evidence or an explicit condition.

## Scope and honest limitations

This is a research-grade vertical slice, not an EPLAN replacement. It does not
yet implement native DWG, full IEC rules, thermal/EMC analysis, production
drilling/NC, complete wire routing/length, vendor-data redistribution, or a
merge-back API from browser edits to the Python EIR service. Generic synthetic
parts are used to avoid claiming rights to manufacturer catalogs. Solver output
is bounded and explainable; `FEASIBLE` is kept distinct from `OPTIMAL`, and a
timeout is reported rather than hidden.

Read `docs/FINAL_REPORT.md` for the evidence-backed decision and
`docs/NEXT_90_DAYS.md` for the productization sequence.
