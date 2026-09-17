# R4.3 OSS Decision

## Decision

**R4.3 architecture PASS; R4.3c runtime outcome: PASS - OSS RUNTIME CORRECTNESS CLOSED.**

This is an architecture decision, not a claim that every OSS runtime is ready to
ship. The two required integration spikes produced useful, auditable results:
Cabinet Layout Generator accepted a CNB EIR projection and generated valid DXF/SVG;
mlightcad's DXF path parsed three real Siemens assets and its simple-viewer package
chain built. The remaining browser/runtime gap is an explicit Phase A gate, not a
reason to continue expanding the custom CAD canvas.

R4.3b closed the Cabinet browser gap and established the initial mlightcad
fixture. R4.3c closed the remaining correctness and visual gates: Cabinet now
has a differential locked/unlocked reflow proof; mlightcad compares full-source
to full-model and visible-source to rendered bounds; G120C's 148.25 mm delta is
traced to visible MTEXT handle 80 rendered as an overlay; and malformed DXF
input is rejected while the last valid scene remains rendered. All required
browser screenshots were opened and reviewed.

## Explicit choices

| Area | Decision | Rationale / guardrail |
|---|---|---|
| Panel editor | **REPLACE the custom generic canvas behind `PanelLayoutAdapter` with Cabinet Layout Generator core/view** | JSON model, Fabric view binding, local reflow, duct snap, collision warnings, and ezdxf export are tested. Keep CNB rail/topology semantics outside it; dual-run first. |
| DXF viewer | **REPLACE the custom SVG-only source viewer behind `CadViewerAdapter` with mlightcad DXF MIT packages** | Three.js renderer, INSERT/block identity, layers, selection metadata, camera, and spatial index cover the generic viewer problem. DXF-only initially. |
| DWG | **DO NOT bundle LibreDWG converter** | Optional converter is GPL-3.0. A commercial/proprietary converter needs a separate procurement and license decision. |
| Schematic | **DO NOT BUILD a new editor; use sldeditor through `SchematicAdapter` in a later milestone** | Its compiler/store/canvas already model symbols, terminals, buses, junctions, wires, routing, and exports. |
| Product catalog | **EXPERIMENT with PartCAD behind `ProductCatalogAdapter`; do not adopt as CNB core** | Useful package/source/revision/BOM substrate, but not a replacement for ProductIdentity, field evidence, or electrical terminal semantics. |
| Wiring documentation | **Keep optional WireViz adapter outside core** | Good YAML harness/BOM output; GPL-3.0 and not a complete system wiring model. |
| 3D | **Survey only** | FreeCAD/Cables and PartCAD are not yet a validated cabinet/terminal/STEP workflow. |
| AI | **KEEP CNB orchestration and typed intent tools; borrow AI-CAD critique/repair/evidence patterns** | AI never emits primitive geometry or renderer calls. CNB rules remain authoritative. |

## What remains custom

CNB continues to own requirements and BOQ ingestion, EIR, ProductIdentity,
ManufacturerPart, PhysicalFootprint, provenance, engineering rules, validation
policy, cabinet selection, BOM intelligence, approval workflow, AI orchestration,
and ERP adapters. These are the differentiators and must not be delegated to an
editor's JSON model.

## Migration plan

### Phase A - adapters and runtime gates

- Freeze the EIR-to-OSS DTOs and ID/provenance map.
- Keep the mlightcad bounds comparison apples-to-apples and retain the source
  audit proving MTEXT overlay extents; do not widen tolerance to hide a mismatch.
- Keep the adapter preflight/post-open validation and last-valid-scene restore
  for malformed, empty, and structurally incomplete DXF payloads.
- Keep Cabinet Layout Generator's actual browser editor evidence as the panel
  adapter gate; rails remain locked visual proxies.
- Add adapter contract tests for unsupported rails and connections.
- Measure bundle, load, conversion, and export timings against the current viewer.

### Phase B - dual run

- Generate old and OSS artifacts from the same EIR revision.
- Compare placement coordinates, rotated bounds, layer/entity counts, hashes, and
  validation findings; display differences for human approval.
- Keep an immediate feature flag rollback to the current CNB workbench.

### Phase C - feature parity gate

Promote OSS as default only when real Siemens source assets pass the browser gate,
mlightcad bounds and invalid-input gates pass, rail proxies remain locked and
traceable, export audits pass, and no critical placement/provenance regression is
observed for two representative cabinets. These R4.3c runtime gates pass for the
DXF-only path. For schematics, require EIR terminal/net round-trip and SVG/DXF
review before enabling the adapter.

### Phase D - remove generic infrastructure

- Delete only the superseded generic viewport/render/selection modules identified
  in `CUSTOM_CODE_REPLACEMENT_CANDIDATES.md`.
- Retain a read-only legacy importer and artifact migration tool for one release.
- Keep CNB validation, audit, provenance, and export fallback code where it is
  still the policy boundary.

## Performance and maintainability gates

- Record mlightcad conversion time and peak browser memory by entity count; the
  package has batching and RBush indexes but no CNB-specific benchmark yet.
- Record Cabinet Layout Generator bundle size (the production build emits a
  >500 kB warning) and whether the FastAPI/ezdxf service is required in deployed
  workflows.
- Pin upstream commits and run a scheduled compatibility build. Avoid a fork until
  adapter-only integration demonstrably fails; if a fork is necessary, retain
  origin, license, and a rebase plan.
- Treat the existing sldeditor parser test failure as upstream test debt; do not
  silently patch it in CNB. Recheck on every upgrade.

## R5 readiness

R5 may begin with adapter implementation, panel dual-run, and CNB engineering work.
It must not begin with new generic CAD features. The old workbench remains a
feature-flagged fallback for rollback, and DWG/GPL conversion remains out of scope.
