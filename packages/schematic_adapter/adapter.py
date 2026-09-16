"""A small, serializable schematic representation.

It is deliberately not a CAD drawing model: node/edge topology and optional
diagram coordinates are separate.  A future sldeditor/QElectroTech adapter can
consume this same document without changing the EIR.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Mapping, Optional

try:
    from pydantic.v1 import BaseModel, Field
except ImportError:  # pragma: no cover
    from pydantic import BaseModel, Field

from packages.domain_model import Connection, Point, Project, canonical_json, stable_id


class SchematicNode(BaseModel):
    id: str
    device_id: Optional[str] = None
    label: str
    symbol_ref: Optional[str] = None
    x: float = 0
    y: float = 0
    page: str = "page-1"

    class Config:
        extra = "forbid"


class SchematicEdge(BaseModel):
    id: str
    connection_id: Optional[str] = None
    from_node: str
    from_terminal: str
    to_node: str
    to_terminal: str
    points: List[Point] = Field(default_factory=list)
    net_label: Optional[str] = None

    class Config:
        extra = "forbid"


class SchematicDocument(BaseModel):
    schema_version: str = "schematic.v1"
    id: str
    project_id: str
    nodes: List[SchematicNode] = Field(default_factory=list)
    edges: List[SchematicEdge] = Field(default_factory=list)
    metadata: Dict[str, str] = Field(default_factory=dict)

    class Config:
        extra = "forbid"

    def to_dict(self) -> Dict[str, object]:
        if hasattr(self, "model_dump"):
            return self.model_dump(exclude_none=True)  # type: ignore[attr-defined]
        return self.dict(exclude_none=True)

    def to_json(self, *, indent: Optional[int] = None) -> str:
        return json.dumps(self.to_dict(), sort_keys=True, ensure_ascii=True, separators=(",", ":"), indent=indent)

    def save(self, path: str | Path) -> None:
        Path(path).write_text(self.to_json(indent=2), encoding="utf-8")

    @classmethod
    def load(cls, path: str | Path) -> "SchematicDocument":
        raw = json.loads(Path(path).read_text(encoding="utf-8"))
        if hasattr(cls, "model_validate"):
            return cls.model_validate(raw)  # type: ignore[attr-defined]
        return cls.parse_obj(raw)


def project_to_schematic(project: Project, *, page_id: str = "page-1") -> SchematicDocument:
    """Project an EIR's devices/connections into a topology-first page."""

    nodes: List[SchematicNode] = []
    device_index = project.device_index()
    part_index = project.part_index()
    placement_index = project.placement_index()
    # Diagram coordinates are independent of panel coordinates; using a coarse
    # deterministic grid gives a readable smoke-test rendering without making
    # panel placement the source of truth.
    for index, device in enumerate(sorted(project.devices, key=lambda item: item.tag)):
        part = part_index.get(device.part_id)
        placement = placement_index.get(device.id)
        nodes.append(
            SchematicNode(
                id=stable_id("sch_node", project.id, device.id),
                device_id=device.id,
                label=device.tag,
                symbol_ref=part.symbol_ref if part else None,
                x=120 + (index % 4) * 180,
                y=120 + (index // 4) * 100,
                page=page_id,
            )
        )
    node_by_device = {node.device_id: node for node in nodes if node.device_id}
    edges: List[SchematicEdge] = []
    for connection in sorted(project.connections, key=lambda item: item.id):
        source = node_by_device.get(connection.from_device)
        target = node_by_device.get(connection.to_device)
        if not source or not target:
            # Keep malformed topology visible to validation rather than
            # dropping it silently.
            continue
        middle = Point(x=(source.x + target.x) / 2, y=(source.y + target.y) / 2)
        edges.append(
            SchematicEdge(
                id=stable_id("sch_edge", project.id, connection.id),
                connection_id=connection.id,
                from_node=source.id,
                from_terminal=connection.from_terminal,
                to_node=target.id,
                to_terminal=connection.to_terminal,
                points=[Point(x=source.x, y=source.y), middle, Point(x=target.x, y=target.y)],
                net_label=connection.label,
            )
        )
    return SchematicDocument(id=stable_id("schematic", project.id, page_id), project_id=project.id, nodes=nodes, edges=edges, metadata={"units": "mm", "page": page_id})


def link_device(schematic: SchematicDocument, device_id: str) -> Optional[SchematicNode]:
    """Resolve a schematic node to the canonical physical device ID."""

    return next((node for node in schematic.nodes if node.device_id == device_id), None)
