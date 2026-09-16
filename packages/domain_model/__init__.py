"""Canonical Electrical Intermediate Representation (EIR).

The model keeps engineering semantics, topology, physical placement, and
drawing geometry as separate concerns.  All dimensions are millimetres unless
explicitly stated otherwise.
"""

from .model import (
    CURRENT_SCHEMA_VERSION,
    Connection,
    Duct,
    Enclosure,
    Footprint,
    Point,
    Placement,
    Project,
    Rail,
    Rect,
    Size,
    Terminal,
    ProductIdentity,
    ProvenanceValue,
    SourceArtifact,
    PartDefinition,
    Device,
    canonical_json,
    from_json,
    from_mm,
    json_schema,
    schema_json,
    stable_id,
    to_mm,
)

__all__ = [
    "CURRENT_SCHEMA_VERSION",
    "Connection",
    "Duct",
    "Enclosure",
    "Footprint",
    "Point",
    "Placement",
    "Project",
    "Rail",
    "Rect",
    "Size",
    "Terminal",
    "ProductIdentity",
    "ProvenanceValue",
    "SourceArtifact",
    "PartDefinition",
    "Device",
    "canonical_json",
    "from_json",
    "from_mm",
    "json_schema",
    "schema_json",
    "stable_id",
    "to_mm",
]
