# CAD Asset Model

The CAD catalog is an evidence layer beside canonical EIR. Raw DXF entities
never enter a `Device` or the authoritative layout model.

```text
SourceAsset (immutable file metadata)
  -> CadRepresentation (front/side/top/unknown + derived vector cache)
       -> GeometryCluster (similarity evidence only)
       -> ProductCandidate (filename/metadata hypothesis)
            -> ProductIdentity (review-confirmed identity)
                 -> PhysicalFootprint (approved mm bounds + provenance)
                      -> PartDefinition.footprint_ref
                           -> Device -> Placement -> layout/validation/export
```

## Objects

`SourceAsset` stores the original relative path, source group, file size,
SHA256, detected DXF version, encoding, raw `source_bbox`, declared units and
the parser findings. Source files are read-only inputs.

`CadRepresentation` stores the explicit view (`front`, `side`, `top` or
`unknown`), `asset_id`, source bounds/units, derived SVG preview reference and
the source-to-preview transform. An unknown view is never silently promoted.

`GeometryCluster` stores exact or translation-normalized geometric similarity.
It is useful for duplicate review only. A shared cluster is not a product
identity and does not merge source records.

`ProductCandidate` groups representations using filename/manufacturer/family
evidence and carries confidence plus `candidate-needs-review` status. The
ET200SP front/side pair demonstrates two representations under one candidate
while retaining separate assets. `ProductIdentity` is reserved for a later
review-confirmed identity.

`PhysicalFootprint` is created only by an approval action. It contains
`physical_width_mm`, `physical_height_mm`, optional depth, unit/view confidence,
and provenance (`approved_from_asset_id`, revision/time, review source). Until
then an asset is preview-only and is excluded from authoritative layout,
collision checks and manufacturing DXF/SVG export.

## Transform contract

The ingestion renderer computes a source-space bounds box and derives a vector
cache with a deterministic source-to-preview translation. For an approved
millimetre footprint, the panel maps the full preview viewBox to the exact
physical footprint rectangle using `preserveAspectRatio="none"`; therefore the
engineering rectangle and rendered CAD bounds have the same width/height in
panel mm. Screen zoom/pan is a separate CSS/SVG transform and is never used to
change physical coordinates.

For unknown or unapproved units, source dimensions remain labelled `source
units`; no raw bbox is converted to mm and no physical layout assertion is
made. A reviewer must provide mm dimensions and a view before approval.
