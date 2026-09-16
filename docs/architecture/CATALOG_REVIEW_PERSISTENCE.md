# Catalog Review Persistence

The forensic catalog is reproducible output. `scripts/audit_catalog.py` reads
the immutable source tree and writes `catalog/generated/catalog-assets.json`
and `catalog/generated/catalog-assets.csv`; it never writes reviewer decisions
back into those files and it excludes `catalog/review/` from ingestion.

Human decisions live in `catalog/review/catalog-review.json`. The web service
merges this review overlay with the generated manifest for `GET /api/catalog`.
The raw source DXF remains unchanged. A review is keyed by
`source_asset_id + representation_id`, while `content_sha256` is only content
integrity/duplicate evidence.

An approval creates a normalized `PhysicalFootprint` with a stable ID, explicit
view, reviewer-provided mm bounds, source-to-physical transform metadata and
provenance. `PartDefinition.footprint_ref` points to that footprint ID; it does
not point at a raw DXF or embed CAD entities in canonical EIR.

`POST /api/catalog/reviews` rejects unknown assets or representations, drawing
sheets, missing front/side/top view and non-positive physical dimensions. The
store is serialized deterministically and written with temp-file plus rename.
Submitting the same engineering values is idempotent; changing view,
dimensions or depth preserves the previous record in `history` and increments
`review_revision`. Re-running the audit or restarting the server therefore
preserves approvals while allowing forensic output to be regenerated.

Tests set `CNB_CATALOG_REVIEW_PATH` to a temporary store. The production store
is intentionally clean until a human approves a real asset. Authoritative DXF,
SVG and audit exports verify the effective catalog server-side and reject an
asset without a matching persisted `physical_footprint_id`.

Synthetic approvals used by tests are explicitly **review-approved test
footprints** and are never retained in the production review store. They
demonstrate persistence and coordinate/export mechanics; they are not
externally verified Siemens vendor footprints.
