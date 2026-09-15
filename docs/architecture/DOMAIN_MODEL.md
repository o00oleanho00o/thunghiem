# Electrical Intermediate Representation

The prototype treats the Electrical Intermediate Representation (EIR) as the
only canonical source of engineering truth. It is versioned as `eir.v1`, uses
millimetres at physical boundaries, and serializes with sorted keys for stable
regression artifacts.

## Boundaries

```text
PartDefinition / Device / Terminal / Connection  = semantics and topology
Placement / Rail / Duct / Enclosure              = physical state
SchematicDocument                                = topology projection
SVG / DXF                                        = derived representations
```

`packages/domain_model/model.py` implements these boundaries with Pydantic
models. `Device.part_id` links an instance to a catalog part; a
`PartDefinition` owns the footprint, mounting type, terminal declarations,
symbol reference, and optional 3D reference. A `Placement` only references a
device and never copies its electrical identity. `Connection` references device
and terminal IDs, so a wire remains meaningful when a drawing is regenerated.

## Core entities

| Entity | Responsibility | Deliberately does not own |
|---|---|---|
| `Project` | schema/version, enclosure, catalog subset, instances, topology | renderer state |
| `PartDefinition` | normalized manufacturer/MPN, ratings, footprint, terminals | project tag |
| `Device` | stable project instance/tag/function/location | coordinates |
| `Placement` | x/y/rotation/rail/zone/lock | BOM or terminal semantics |
| `Rail` / `Duct` | mounting and service corridors | device identity |
| `Connection` | terminal-level topology | line geometry |
| `SchematicDocument` | deterministic topology-first page projection | panel coordinates |

Stable IDs use a namespaced SHA-1 digest (`stable_id`) rather than random UUIDs
for reproducible imports and DXF regression tests. External integrations may
retain their own source IDs in `metadata`.

## Invariants

- `schema_version` is an `eir.*` value and `units` is explicitly `mm`.
- IDs are unique within each collection; device tags are checked by validation.
- Footprints have positive dimensions and right-angle rotation constraints.
- A DIN-mounted placement references a rail and is checked against rail bounds.
- Topology references declared devices and terminal IDs.
- Geometry is never used to infer connectivity; importers may attach an
  uncertainty note when semantics are reconstructed from legacy drawings.

## Evolution

Additive fields should use a new minor schema version and preserve unknown
source metadata. Breaking changes require a migration function and fixtures for
every example panel. JSON is the interchange/debug format; a database can be
introduced later without changing the EIR contract.

