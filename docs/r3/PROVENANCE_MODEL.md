# R3.1b Provenance Model

`ProductIdentity` is separate from `Footprint`, CAD representation and schematic symbol. ABB identity has explicit `type_designation`, `manufacturer_order_code`, `rated_current_a` and `characteristic` fields. Each `PartDefinition` carries a field-level provenance ledger.

Allowed statuses include `document_verified`, `engineering_default`, `unknown` and the other domain confidence levels. A null value is never `document_verified`. Vendor mounting position (`any`) is separate from the CNB layout policy (`allowed_rotations=[0]`).

The engineering-layout release may pass with explicit warnings for unknown clearance, service access, terminal model and exact CAD. Manufacturing-ready release rejects those unknowns. The export manifest hashes the catalog, source-artifact manifest, canonical EIR, validation policy, validation report and generated DXF; the verifier also hashes every source-artifact byte.
