# R4 — Real DXF Cabinet Composer

## Decision

**R4 PASS WITH DATA LIMITATION — GO TO R5 CABINET FIT WITH CONDITIONS**

The composer proves the CAD interaction and geometry-preservation path. It does
not claim a verified Siemens physical catalog. All eight selected Siemens assets
remain preview-only because exact product identity and physical mapping are not
supported by the supplied DXF evidence.

## Catalog triage

The current generated catalog contains 58 parsed assets: 36 from `radica-dxf`,
16 from `siemens-batch-w33` and 6 from `siemens-bilddb`. The vector-cache
manifest contains eight reusable cache records used by the R4 benchmark. Each
record retains source path, source SHA256, representation ID, bounds and entity
count. The selected set covers S7-1200, S7-1500, SIRIUS, SITOP/drawing-sheet
and SINAMICS candidate families.

| Status | Count | Meaning |
|---|---:|---|
| Source geometry verified | 8 | DXF parsed and vector cache available |
| Identity exact verified | 0 | Filename/family is not enough for exact MPN |
| Physical mapping approved | 0 | No defensible exact-product mm mapping |
| Preview-only | 8 | Safe to inspect/render, excluded from authoritative fit |

The source DXFs are not mutated. Several files declare no units, and some
declared-mm files are drawing sheets or contain annotation/title-block content.
The R4 benchmark therefore uses source-unit geometry only in an explicitly
non-authoritative preview model. No source bbox is silently relabeled as mm.

## Component model and transform

Each dropped asset is one `ComponentInstance` with `assetId`, representation
reference, position, rotation, rail, lock state and independent statuses:

```text
geometry_status: source_verified
identity_status: candidate_needs_review
physical_mapping_status: unknown
```

The server export boundary loads the referenced vector-cache JSON, normalizes
the source origin, applies scale and right-angle rotation, then translates into
cabinet coordinates. Raw CAD entities do not enter canonical EIR persistence.

## Demonstrated behavior

- real vector thumbnail and detail inspection;
- direct asset drag/drop into the preview composer;
- one semantic object for a multi-entity DXF;
- DIN rail snap for DIN candidates;
- pan, cursor zoom, selection and deep zoom;
- auto-layout over the current preview envelope;
- lock, manual move and regenerate preserving the locked component;
- red validation outline without replacing the CAD image with a fake rectangle;
- preview DXF and SVG export containing transformed `CAD_GEOMETRY` primitives;
- independent ezdxf reopen.

The generated R4 export contains 12,911 entities: 5,797 LINE, 7,051 ARC,
43 CIRCLE and 20 TEXT, with `AC1009` header and sensible 1600 × 1100 bounds.
The real geometry layer is substantially larger than an envelope-only export.

## Explicit limitation

R4 does not have three engineering-placement capable Siemens products yet.
R2B already established that Siemens Industry Mall/support access was blocked
in this environment and that exact MPN/dimensions must not be inferred. The
correct behavior is preview-only rendering and an authoritative-placement
block, not a fabricated scale or an ABB/Siemens identity merge.

R5 may proceed using verified ABB engineering envelopes or a future reviewed
internal/vendor mapping, while retaining this preview composer as a separate
CAD representation path.
