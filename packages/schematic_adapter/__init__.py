"""Minimal topology-first schematic adapter and physical-device linking."""

from .adapter import (
    SchematicDocument,
    SchematicEdge,
    SchematicNode,
    link_device,
    project_to_schematic,
)

__all__ = ["SchematicDocument", "SchematicEdge", "SchematicNode", "link_device", "project_to_schematic"]

