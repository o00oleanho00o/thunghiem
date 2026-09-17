# R5 Unified Engineering Workbench Report

## Decision

**PASS: unified Engineering Web + Engineering API.** The canonical demo is
`r5-real-cabinet`. CNB EIR remains the engineering truth source. Cabinet and
mlightcad are embedded through adapters as projections/edit surfaces.

R5 does not add a generic CAD product. It closes the integration boundary needed
to move from the R4.3c runtime gate to one engineering workflow.

## Delivered surface

| Surface | Implementation | Port |
|---|---|---:|
| Engineering Web | `apps/engineering-web` Vite shell, Vietnamese routes and shared DOM | 4200 |
| Engineering API | `services/engineering-api` wrapper over proven CNB API modules | 8200 |
| Panel adapter | `packages/adapters/cabinet-layout` | in-process |
| CAD adapter | `packages/adapters/mlightcad` | in-process |
| Demo truth | `examples/r5-real-cabinet/project.json` (EIR v1) | file-backed |

Routes in the canonical shell are overview, BOM, devices, panel, CAD source,
validation and export. The production-like demo uses exactly two long-lived
processes. Ports 4178/4179 remain experimental harnesses only.

## Truth and workflow

- Siemens product identity, order code, footprint and provenance are read from
  EIR `parts` and `devices`.
- CAD references are candidate mappings. All three demo devices have
  `placement_capable: false`.
- Drag, lock, reflow and save produce Draft/candidate placement state.
- Candidate placement revisions are persisted by the Engineering API without
  changing the source EIR file or approval state.
- Export and audit go through the CNB API modules; the browser only presents the
  result and metadata.

## Runtime findings

The pinned mlightcad DXF bundle renders KTP700 and G120C in the shared CAD tab.
The tab opens KTP700 by default and exposes a project-device picker for G120C
and SITOP, so a direct CAD route is useful without first visiting the panel.
Selection, layer inventory, bounds overlays and source-fit controls are visible
through the runtime bridge. The adapter obtains the real DXF basename from the
API `Content-Disposition` header, so the runtime's `.dxf` input gate is honored
while EIR IDs remain stable link keys. The separate local `Mở DXF` control is
reserved for invalid-input guard testing.

Invalid input is rejected before `openDocument`; a valid last scene is retained.
The browser test now waits for the target asset before injecting invalid input,
and waits for a stable non-zero rendered scene before taking the evidence shot.

## Verification

Run:

```text
npm run build:web
npm run test:r5
```

The final result is `PASS_UNIFIED_ENGINEERING_WORKBENCH` with 19 checks, no page
errors, 11 route switches, KTP700 and G120C load timings, and 13 screenshots.
The machine-readable result is [evidence/r5/runtime-result.json](../../evidence/r5/runtime-result.json).

## Scope limits

This milestone intentionally does not add DWG support, GPL LibreDWG code,
ERPNext integration, generic block editing, or a new schematic/3D subsystem.
Those remain outside the R5 acceptance surface.
