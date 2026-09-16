# R3.1 Truth Closure Report

## Decision

**R3.1 PASS WITH CONDITIONS — GO TO R4 LIMITED**

The authoritative dataset now uses locally cached official ABB documentation rather than dead Phoenix URLs. Eight exact ABB order codes are backed by one successfully retrieved official PDF artifact with SHA256 and page/table locators. The model deliberately leaves product-specific clearance, service access, terminal identifiers/count and exact CAD unknown. A separate 5 mm `CNB-CLEARANCE-DEFAULT-V1` engineering default is applied to layout; it is not represented as an ABB requirement.

## Evidence

- Source artifact: `catalog/r3/abb-s200-datasheet.pdf`
- Artifact manifest: `catalog/r3/source-artifacts/manifest.json`
- Artifact SHA256: `e3bd374e5540f76034b0168fdf45742ba88dce7e579e522b01449311de54a7e1`
- Exact MPNs: S201U-C6, C10, C16, C20, C25, C32, C40 and C63.
- Dimensions/mounting/rail width/order code provenance points to PDF pages 3 and 6.
- All Phoenix records were removed from the R3.1 authoritative catalog; their blocked URLs are retained only in earlier R3 evidence.

## Truth boundaries

`width_mm`, `height_mm`, `depth_mm`, `mounting`, `rail_width_mm` and order code are `document_verified`. `clearance_mm`, service face/depth and terminal IDs/count are `unknown` in the product records. The benchmark EIR records the 5 mm company default as `engineering_default` with policy ID, never as vendor data. Terminal lists remain empty and topology is intentionally not fabricated.

## Cabinet and validation

The regenerated cabinet contains 24 physical devices, multiple DIN rails and vertical/horizontal ducts. Heuristic and CP-SAT layouts pass authoritative validation. E004 evidence identifies `engineering_default` and `CNB-CLEARANCE-DEFAULT-V1`; E005 remains a warning when access metadata is unknown and an error when an access corridor is deliberately blocked. Missing mandatory provenance and unknown authoritative fields are rejected before export.

The final DXF reopens with ezdxf and has zero audit errors. The export chain includes catalog, source-artifact manifest, canonical EIR, validation policy, validation report and DXF hashes; `scripts/verify_export_chain.py` passes and detects tampering.

## R4 boundary

Proceed only to a limited R4 experiment. Do not claim procurement/manufacturing truth until terminal identifiers, service clearances and product-specific installation evidence are cached for the selected parts. Full wire routing remains out of scope.
