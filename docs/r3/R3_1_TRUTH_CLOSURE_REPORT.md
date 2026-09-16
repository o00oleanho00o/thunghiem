# R3.1b Final Engineering Truth Closure

## Decision

**R3 CLOSED - GO TO R4 LIMITED**

R3 proves an engineering-layout-grade truth pipeline, not manufacturing readiness.

## Identity and evidence

- Exact ABB type designations: 8 (`S201U-C6`, `C10`, `C16`, `C20`, `C25`, `C32`, `C40`, `C63`).
- Exact ABB manufacturer order codes: 8 distinct codes, including C6 `2CDS271417R0064`, C16 `2CDS271417R0164` and C63 `2CDS271417R0634`.
- Source artifacts: 1 official cached ABB PDF, verified byte-for-byte in the export chain.
- `document_verified`: type designation, manufacturer order code, rated current, characteristic, width, height, depth, DIN rail mounting, rail width and vendor mounting position `any`.
- `engineering_default`: 5 mm clearance (`CNB-CLEARANCE-DEFAULT-V1`) and layout rotation `[0]` (`CNB-LAYOUT-ROTATION-V1`).
- `unknown`: product clearance, service-access direction/depth, terminal identifiers/count and exact-product CAD.

The source review is a reviewed extraction from the official cached artifact, with page/table locators, not an automatically parsed vendor-data claim. See `ABB_SOURCE_REVIEW.md`.

## Validation release levels

The 24-device ABB benchmark is **Engineering Layout Valid**: zero errors and explicit warnings for clearance policy, unknown terminal model and unknown service access. The regenerated layout is not Manufacturing Ready. Manufacturing release intentionally rejects unknown terminal model, service/install requirements and product-specific clearance.

The final validation report contains 72 warnings (24 devices x three explicit unknown/default classes) and zero errors. Unknown values are never promoted to `document_verified`.

## Independent integrity evidence

- Source PDF bytes are resolved from `source-artifacts/manifest.json` and SHA256-compared by `scripts/verify_export_chain.py`.
- Tampered bytes, changed manifest SHA and missing artifacts fail the verifier in tests.
- Final DXF reopens with ezdxf as AC1009 with 311 modelspace entities and zero audit errors.
- The benchmark metadata is ABB-only; stale Phoenix records and review-only semantics were removed from the R3.1 catalog/benchmark.

## R4 boundary

Proceed only to a limited R4 experiment. Do not claim procurement or manufacturing truth until terminal identifiers, service clearances, product-specific installation evidence, accessories and exact CAD where required are cached and reviewed. Full wire routing remains out of scope.
