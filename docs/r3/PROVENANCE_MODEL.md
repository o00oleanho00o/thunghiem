# R3 Provenance Model

`ProductIdentity` is separate from `Footprint`, CAD representation and schematic symbol. Each `PartDefinition` may carry a `product_identity` plus a field-level `provenance` ledger. A ledger record contains `value`, `source`, `source_type` and `confidence`.

Allowed confidence levels are `vendor_verified`, `review_verified`, `trusted_secondary`, `inferred`, and `unknown`. The R3 authoritative benchmark accepts only `review_verified` or `vendor_verified`. Unknown terminal pitch, accessory envelope, bend radius and installation clearances remain explicit in `known_unknowns` and are not silently promoted.

The benchmark manifest hashes `catalog/r3/products.json`, the source EIR, the validation report and the generated DXF so an export can be traced to one catalog snapshot.
