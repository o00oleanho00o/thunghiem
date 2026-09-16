# Siemens DXF Catalog Forensic Audit

Audit command: `python scripts/audit_catalog.py catalog` (2026-09-16).
The command reads source files without changing them and writes derived data to
`catalog/generated/`.

## Dataset and parse result

The local tree contains **58 files**, not 56 as the original handoff stated:
36 in `radica-dxf`, 16 in `siemens-batch-w33`, and 6 in `siemens-bilddb`.
All 58 passed content sniffing and parsed successfully with `ezdxf 1.4.4`.
The importer does not require a `.dxf` extension, and the 36 extensionless
Radica files were accepted by content.

| Measure | Result |
|---|---:|
| Parsed | 58 / 58 |
| Parse failures | 0 |
| Product candidates | 57 |
| DXF versions | AC1009: 46; AC1015: 4; AC1024: 2; AC1027: 2; AC1032: 4 |
| Declared units | millimetres: 10; unitless: 2; undeclared: 46 |
| Bounding width | 23.81–677.60 (mean 103.94) |
| Bounding height | 23.81–431.80 (mean 143.34) |
| Explicit front views | 1 |
| Explicit side views | 1 |
| Unknown view | 56 |
| Annotation-bearing files | 12 |
| INSERT-bearing files | 10 |
| Drawing-sheet heuristic | 8 |
| Suitable direct footprint candidates | 46 (heuristic) |

Dimensions are reported in the file's declared units when available. For the
46 undeclared files the audit deliberately does not silently assume a unit.
`candidate_view=unknown` is retained unless the filename explicitly contains
`front-view`, `side-view`, or `top-view`.

The generated manifest exposes `products[]` with nested `representations[]`.
Product candidates are grouped from filename/manufacturer/family evidence, not
from geometry fingerprints. Exact/translation-normalized geometry groups are
separate `geometry_cluster_id` evidence. The ET200SP `front-view` and
`side-view` files resolve to one candidate with two representations while each
original source file remains separate. No ProductIdentity is authoritative
until review.

## Entity and structure findings

The manifest records per-file entity type counts, layer names, block names,
modelspace/paperspace presence, bounding box, annotation flags, INSERT flags,
SHA256, and a normalized geometry fingerprint. DXF title blocks and annotation
entities are present in 12 assets, so those assets need review before being
treated as a production panel footprint. INSERT/BLOCK content is retained as
source evidence; preview generation expands common INSERT geometry into a
web-vector cache and caps rendered segments at 5,000 for browser performance.

Aggregate modelspace entities are: `ARC` 76,042, `LINE` 38,304, `TEXT`
1,062, `CIRCLE` 46, `INSERT` 68, `LWPOLYLINE` 164, `POLYLINE` 36,
`HATCH` 34 and `MTEXT` 20. All files are ASCII-decodable in this snapshot;
the manifest still stores the detected encoding per file.

## Duplicate analysis

There are **11 exact duplicate groups** by SHA256. They occur across the
Radica/batch and batch/BildDB directories, showing that the directories are
provenance variants rather than 11 additional physical products. The same 11
groups also produce translation-normalized geometric fingerprints. No other
near-duplicate group crossed the confidence threshold, and no uncertain pair
was merged automatically. See `catalog/generated/catalog-assets.json` for the
complete path pairs and reasons.

## Asset model and approval posture

Each record is a `CadAsset`-like representation with an immutable source path,
source group, SHA256, detected version/units, geometry bounds, preview and
review status. Filename evidence supplies only a candidate manufacturer,
family, description and view. It never invents an order number. A browser
approval creates a `footprintRef`/asset reference on a component; raw DXF
entities remain outside canonical EIR.

## Suitability decisions

- Preview-only candidates: all 58 assets initially. Parsed geometry with a
  finite non-extreme bounding box is a browse candidate, not an engineering
  footprint.
- Needs cleanup/review: annotation-bearing files, INSERT-heavy files, all
  unknown-view assets, and any unitless/undeclared asset used for manufacturing.
- Approved footprints in this snapshot: 0 from automatic ingestion. Approval
  requires reviewer-supplied mm bounds and a view, with provenance recorded.

Initial workflow states are `needs-unit-review` for 48 files and
`needs-product-review` for the 10 declared-mm drawing sheets. The 46-file
“suitable” count is only a geometry/preview heuristic and must not be read as
46 production-ready footprints.
- Rejected: none in this dataset. A future ingestion run should reject parse
  failures or non-finite/extreme geometry explicitly rather than fabricate a
  footprint.

## Lessons for future ingestion

1. Directory names and filenames are useful provenance, not a reliable product
   identity; exact duplicates must remain separate until provenance policy is
   chosen.
2. Unit declarations are sparse, so physical placement must carry an explicit
   `unitConfidence`/review state.
3. A single DXF can contain a title block, annotations, blocks and modelspace
   geometry. `one file = one PartDefinition` is unsafe.
4. The web editor should consume normalized SVG/vector caches and real bounds,
   never parse raw DXF on every frame.
