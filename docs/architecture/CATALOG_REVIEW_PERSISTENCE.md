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
Updating a review preserves the previous record in `history` and increments
`review_revision`. Re-running the audit or restarting the server therefore
preserves approvals while allowing forensic output to be regenerated.

The current demo approval is explicitly a **review-approved test footprint**.
It demonstrates persistence and coordinate/export mechanics; it is not an
externally verified Siemens vendor footprint.
