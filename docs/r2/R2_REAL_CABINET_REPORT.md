# R2 Real Cabinet Benchmark Report

## Decision

**CONTINUE WITH NARROWER WEDGE.** The deterministic BOM-to-panel pipeline is
technically viable for a reference cabinet, but the supplied DXF catalog does
not provide enough unit and product evidence to claim production-ready
Siemens footprints. The next product slice should be review-gated catalog
normalization plus BOM -> panel -> DXF, with an engineer approving each
physical representation.

## Reproducible run

```powershell
.venv/Scripts/python.exe scripts/build_r2_benchmark.py
.venv/Scripts/python.exe scripts/audit_dxf_ezdxf.py benchmarks/r2-real-cabinet/artifacts/r2-reference-cabinet.dxf
.venv/Scripts/python.exe scripts/render_dxf_ezdxf.py benchmarks/r2-real-cabinet/artifacts/r2-reference-cabinet.dxf evidence/screenshots/r2-reference-cabinet.png
```

## Evidence

The frozen input and resolution tables are `benchmarks/r2-real-cabinet/`.
The generated canonical EIR, SVG, DXF and internal audit are under its
`artifacts/` directory. The independent ezdxf audit opened AC1009 with 217
entities (186 LINE, 31 TEXT), zero audit errors, explicit
`COMPONENT_OUTLINE`/`COMPONENT_DETAIL` layers, and bounds 1200 x 1600 mm.
The rendered screenshot is `evidence/screenshots/r2-reference-cabinet.png`.

## Layout experiment

The 15-component reference run had zero overlap pairs, zero validation errors,
8.304% occupied plate area, and an OR-Tools CP-SAT `OPTIMAL` result. Repeated
scale runs were deterministic: 10 components solved in about 15 ms and 30 in
about 43 ms on the capture machine. The 100-component run was rejected by the
explicit capacity guard (11 rail rows require 230 mm pitch but only 116 mm is
available), which is useful evidence rather than a hidden failure. A locked
component retained its exact coordinates after regeneration.

## What the experiment does and does not prove

It proves that catalog provenance, EIR semantics, normalized source envelopes,
heuristic/CP-SAT placement, validation, and independent DXF round-trip can be
run together offline. It does not prove that a filename candidate has a
correct Siemens order number, units, orientation, mounting pattern, clearance,
or manufacturing suitability. The current catalog contains no externally
verified footprint approvals in production review storage.

## Next actions

1. Review a small set of declared-mm assets against vendor data or measured drawings.
2. Add explicit representation roles (front/side/top/unknown) only after review.
3. Add normalized vector geometry references to the authoritative export while retaining source DXF unchanged.
4. Benchmark duct fill, service clearance, and terminal accessibility with real BOMs.
5. Capture browser screenshots for library, detail, deep zoom, pan and approved-vector panel states.
