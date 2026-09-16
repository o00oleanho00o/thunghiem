"""Versioned electrical domain model used by every prototype stage.

The important architectural boundary is intentional:

* :class:`Device` and :class:`Connection` describe engineering semantics.
* :class:`Placement`, :class:`Rail`, and :class:`Duct` describe physical state.
* CAD exporters consume the model but are never the source of truth.

Pydantic v1 is supported because it is available in the lab runtime.  The
small compatibility helpers also work with Pydantic v2's ``model_dump`` API.
"""

from __future__ import annotations

import hashlib
import copy
import json
import math
import re
from typing import Any, Dict, Iterable, List, Literal, Mapping, Optional, Tuple

try:  # Pydantic 2 ships the fully supported v1 compatibility namespace.
    from pydantic.v1 import BaseModel, Field, root_validator, validator
except ImportError:  # pragma: no cover - for older Pydantic 1 installations
    from pydantic import BaseModel, Field, root_validator, validator

CURRENT_SCHEMA_VERSION = "eir.v1"

_MM_PER_UNIT = {"mm": 1.0, "cm": 10.0, "m": 1000.0, "in": 25.4}


def to_mm(value: float, unit: str) -> float:
    """Convert an explicit supported unit to canonical millimetres."""

    try:
        factor = _MM_PER_UNIT[unit.lower()]
    except KeyError as exc:
        raise ValueError(f"unsupported length unit: {unit!r}") from exc
    result = float(value) * factor
    if not math.isfinite(result):
        raise ValueError("length must be finite")
    return result


def from_mm(value: float, unit: str) -> float:
    """Convert canonical millimetres to an explicit supported unit."""

    try:
        factor = _MM_PER_UNIT[unit.lower()]
    except KeyError as exc:
        raise ValueError(f"unsupported length unit: {unit!r}") from exc
    result = float(value) / factor
    if not math.isfinite(result):
        raise ValueError("length must be finite")
    return result


def _dump(model: BaseModel, *, by_alias: bool = True) -> Dict[str, Any]:
    """Dump a pydantic model on both v1 and v2."""

    if hasattr(model, "model_dump"):
        return model.model_dump(by_alias=by_alias, exclude_none=True)  # type: ignore[attr-defined]
    return model.dict(by_alias=by_alias, exclude_none=True)


def _validate(model_type: Any, value: Any) -> Any:
    if hasattr(model_type, "model_validate"):
        return model_type.model_validate(value)  # type: ignore[attr-defined]
    return model_type.parse_obj(value)


def stable_id(namespace: str, *parts: object) -> str:
    """Return a short, deterministic ID suitable for persisted references.

    UUIDs are deliberately avoided for generated examples: a repeated import
    should produce byte-identical JSON and DXF output for regression testing.
    """

    payload = "|".join([namespace, *(str(p) for p in parts)])
    digest = hashlib.sha1(payload.encode("utf-8")).hexdigest()[:12]
    safe_namespace = re.sub(r"[^a-zA-Z0-9_]+", "_", namespace).strip("_") or "id"
    return f"{safe_namespace}_{digest}"


class EIRBase(BaseModel):
    class Config:
        extra = "forbid"
        validate_assignment = True
        allow_mutation = True
        use_enum_values = True

    def to_dict(self) -> Dict[str, Any]:
        return _dump(self)


class Point(EIRBase):
    x: float
    y: float

    @validator("x", "y")
    def finite(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("coordinate must be finite")
        return float(value)


class Size(EIRBase):
    width: float = Field(gt=0)
    height: float = Field(gt=0)

    @validator("width", "height")
    def finite(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("dimension must be finite")
        return float(value)


class Rect(EIRBase):
    """Axis-aligned rectangle in mm, represented by its lower-left corner."""

    x: float
    y: float
    width: float = Field(gt=0)
    height: float = Field(gt=0)

    @validator("x", "y", "width", "height")
    def finite(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("rectangle values must be finite")
        return float(value)

    @property
    def right(self) -> float:
        return self.x + self.width

    @property
    def top(self) -> float:
        return self.y + self.height

    @property
    def center(self) -> Point:
        return Point(x=self.x + self.width / 2, y=self.y + self.height / 2)

    def intersects(self, other: "Rect", clearance: float = 0.0) -> bool:
        """Return true for a positive-area overlap (touching is allowed)."""

        return not (
            self.right + clearance <= other.x
            or other.right + clearance <= self.x
            or self.top + clearance <= other.y
            or other.top + clearance <= self.y
        )

    def contains(self, other: "Rect", margin: float = 0.0) -> bool:
        return (
            self.x + margin <= other.x
            and self.y + margin <= other.y
            and self.right - margin >= other.right
            and self.top - margin >= other.top
        )

    def translated(self, x: float, y: float) -> "Rect":
        return Rect(x=x, y=y, width=self.width, height=self.height)


class Footprint(EIRBase):
    """Physical footprint and mounting metadata for a manufacturer part."""

    width: float = Field(gt=0)
    height: float = Field(gt=0)
    depth: float = Field(gt=0)
    mounting: Literal["din_rail", "backplate", "free", "terminal_rail"] = "free"
    rail_width: Optional[float] = Field(default=None, gt=0)
    keepout_left: float = Field(default=0.0, ge=0)
    keepout_right: float = Field(default=0.0, ge=0)
    keepout_top: float = Field(default=0.0, ge=0)
    keepout_bottom: float = Field(default=0.0, ge=0)
    clearance_mm: Optional[float] = Field(default=0.0, ge=0)
    service_access_direction: Optional[Literal["left", "right", "top", "bottom", "front", "unknown"]] = None
    service_access_depth_mm: Optional[float] = Field(default=None, gt=0)
    # Vendor mounting-position evidence is intentionally separate from the
    # restricted orientation policy used by the current 2D layout solver.
    vendor_mounting_position: Optional[Literal["any", "vertical", "horizontal", "unknown"]] = None
    allowed_rotations: List[int] = Field(default_factory=lambda: [0])

    @validator("allowed_rotations")
    def rotations(cls, value: List[int]) -> List[int]:
        result = sorted(set(int(v) % 360 for v in value))
        if not result or any(v not in (0, 90, 180, 270) for v in result):
            raise ValueError("allowed_rotations must contain right-angle values")
        return result

    @property
    def total_width(self) -> float:
        return self.width + self.keepout_left + self.keepout_right

    @property
    def total_height(self) -> float:
        return self.height + self.keepout_top + self.keepout_bottom

    def oriented_size(self, rotation: int) -> Size:
        if rotation % 180:
            return Size(width=self.height, height=self.width)
        return Size(width=self.width, height=self.height)


class Terminal(EIRBase):
    id: str
    name: str
    kind: Literal["power", "control", "signal", "protective_earth", "generic"] = "generic"
    index: Optional[int] = None

    @validator("id", "name")
    def nonempty(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("terminal text must not be empty")
        return value


class ProductIdentity(EIRBase):
    """Traceable commercial identity; deliberately separate from CAD geometry."""

    manufacturer: str
    series: str
    type_designation: str
    manufacturer_order_code: str
    rated_current_a: Optional[float] = Field(default=None, gt=0)
    characteristic: Optional[str] = None
    description: str
    source_url: Optional[str] = None
    source_document: Optional[str] = None
    source_type: Literal["official_product_page", "official_datasheet", "official_cad", "document_verified", "vendor_verified", "review_verified"]
    retrieved_at: str
    verification_status: Literal["vendor_verified", "document_verified", "human_measured", "trusted_secondary", "engineering_default", "inferred", "unknown", "needs_review", "review_verified"]

    @validator("manufacturer", "series", "type_designation", "manufacturer_order_code", "description", "retrieved_at")
    def identity_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("product identity text must not be empty")
        return value


class ProvenanceValue(EIRBase):
    """Evidence attached to one engineering field."""

    value: Any = None
    status: Literal["vendor_verified", "document_verified", "human_measured", "trusted_secondary", "engineering_default", "inferred", "unknown"] = "unknown"
    source: Optional[str] = None
    source_artifact_id: Optional[str] = None
    source_locator: Optional[str] = None
    reviewed_at: Optional[str] = None
    notes: str = ""
    source_type: Literal["vendor_datasheet", "official_product_page", "official_cad", "review", "inferred", "engineering_default", "unknown"] = "unknown"
    confidence: Literal["vendor_verified", "document_verified", "review_verified", "trusted_secondary", "engineering_default", "inferred", "unknown"] = "unknown"


class SourceArtifact(EIRBase):
    id: str
    manufacturer: str
    manufacturer_part_number: str
    type: Literal["official_datasheet_pdf", "official_technical_drawing", "official_cad", "official_manual_pdf"]
    original_url: str
    local_path: str
    sha256: str
    retrieved_at: str
    retrieval_status: Literal["success", "failed"]
    document_revision: Optional[str] = None
    document_date: Optional[str] = None


class PartDefinition(EIRBase):
    """Catalog-level part; it has no project-specific tag or placement."""

    id: str
    manufacturer: str
    manufacturer_part: str
    description: str
    category: str
    footprint: Footprint
    terminals: List[Terminal] = Field(default_factory=list)
    ratings: Dict[str, str] = Field(default_factory=dict)
    symbol_ref: Optional[str] = None
    footprint_ref: Optional[str] = None
    model_3d_ref: Optional[str] = None
    product_identity: Optional[ProductIdentity] = None
    provenance: Dict[str, ProvenanceValue] = Field(default_factory=dict)
    source_artifacts: List[SourceArtifact] = Field(default_factory=list)
    terminal_model_status: Literal["document_verified", "unknown"] = "unknown"
    # Optional provenance link to an imported CAD asset. Raw CAD entities stay
    # outside EIR; this stable ID only points at the catalog representation.
    cad_asset_id: Optional[str] = None
    cad_geometry_ref: Optional[str] = None
    aliases: List[str] = Field(default_factory=list)

    @validator("id", "manufacturer", "manufacturer_part", "description", "category")
    def required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("catalog text must not be empty")
        return value

    @validator("terminals")
    def unique_terminal_ids(cls, value: List[Terminal]) -> List[Terminal]:
        ids = [terminal.id for terminal in value]
        if len(ids) != len(set(ids)):
            raise ValueError("part terminal IDs must be unique")
        return value


class Device(EIRBase):
    """Project-level logical/physical device instance."""

    id: str
    tag: str
    part_id: str
    function: str = "general"
    location: str = "cabinet"
    description: Optional[str] = None
    terminal_ids: List[str] = Field(default_factory=list)
    properties: Dict[str, str] = Field(default_factory=dict)

    @validator("id", "tag", "part_id", "function", "location")
    def nonempty(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("device identity fields must not be empty")
        return value

    @validator("terminal_ids")
    def unique_terminal_ids(cls, value: List[str]) -> List[str]:
        if len(value) != len(set(value)):
            raise ValueError("device terminal IDs must be unique")
        return value


class Placement(EIRBase):
    """Physical placement of a device, separate from its semantics."""

    device_id: str
    x: float = Field(ge=0)
    y: float = Field(ge=0)
    rotation: int = 0
    rail_id: Optional[str] = None
    zone: Optional[str] = None
    locked: bool = False

    @validator("rotation")
    def right_angle(cls, value: int) -> int:
        value = int(value) % 360
        if value not in (0, 90, 180, 270):
            raise ValueError("rotation must be a right angle")
        return value


class Rail(EIRBase):
    id: str
    x: float = Field(ge=0)
    y: float = Field(ge=0)
    length: float = Field(gt=0)
    width: float = Field(default=35.0, gt=0)
    orientation: Literal["horizontal", "vertical"] = "horizontal"


class Duct(EIRBase):
    id: str
    x: float = Field(ge=0)
    y: float = Field(ge=0)
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    kind: Literal["wire_duct", "busbar", "reserved"] = "wire_duct"

    def rect(self) -> Rect:
        return Rect(x=self.x, y=self.y, width=self.width, height=self.height)


class Enclosure(EIRBase):
    id: str = "enclosure"
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    depth: float = Field(gt=0)
    plate_margin: float = Field(default=50.0, ge=0)
    reserve_percent: float = Field(default=20.0, ge=0, lt=100)

    @property
    def plate(self) -> Rect:
        return Rect(
            x=self.plate_margin,
            y=self.plate_margin,
            width=self.width - 2 * self.plate_margin,
            height=self.height - 2 * self.plate_margin,
        )

    @validator("plate_margin")
    def margin_fits(cls, value: float, values: Dict[str, Any]) -> float:
        width = values.get("width")
        height = values.get("height")
        if width is not None and value * 2 >= width:
            raise ValueError("plate margin leaves no width")
        if height is not None and value * 2 >= height:
            raise ValueError("plate margin leaves no height")
        return value

    @root_validator(skip_on_failure=True)
    def plate_has_positive_area(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        width = values.get("width")
        height = values.get("height")
        margin = values.get("plate_margin", 50.0)
        if width is not None and height is not None and (2 * margin >= width or 2 * margin >= height):
            raise ValueError("plate margin leaves no mounting plate area")
        return values


class Connection(EIRBase):
    id: str
    from_device: str
    from_terminal: str
    to_device: str
    to_terminal: str
    kind: Literal["wire", "bus", "cable", "potential"] = "wire"
    wire_size_mm2: Optional[float] = Field(default=None, gt=0)
    color: Optional[str] = None
    label: Optional[str] = None

    @validator("id", "from_device", "from_terminal", "to_device", "to_terminal")
    def connection_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("connection references must not be empty")
        return value


class Project(EIRBase):
    """Root EIR document persisted as canonical JSON."""

    schema_version: Literal["eir.v1"] = CURRENT_SCHEMA_VERSION
    id: str
    name: str
    units: Literal["mm"] = "mm"
    enclosure: Enclosure
    parts: List[PartDefinition] = Field(default_factory=list)
    devices: List[Device] = Field(default_factory=list)
    placements: List[Placement] = Field(default_factory=list)
    rails: List[Rail] = Field(default_factory=list)
    ducts: List[Duct] = Field(default_factory=list)
    connections: List[Connection] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @validator("id", "name")
    def project_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("project identity fields must not be empty")
        return value

    @root_validator(skip_on_failure=True)
    def unique_ids(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        for field in ("parts", "devices", "placements", "rails", "ducts", "connections"):
            entries = values.get(field) or []
            identity_field = "device_id" if field == "placements" else "id"
            ids = [getattr(item, identity_field) for item in entries]
            duplicate = next((item for index, item in enumerate(ids) if item in ids[:index]), None)
            if duplicate is not None:
                raise ValueError(f"duplicate {field} id: {duplicate}")
        return values

    def part_index(self) -> Dict[str, PartDefinition]:
        return {part.id: part for part in self.parts}

    def device_index(self) -> Dict[str, Device]:
        return {device.id: device for device in self.devices}

    def placement_index(self) -> Dict[str, Placement]:
        return {placement.device_id: placement for placement in self.placements}

    def footprint_rect(self, device_id: str) -> Optional[Rect]:
        device = self.device_index().get(device_id)
        placement = self.placement_index().get(device_id)
        part = self.part_index().get(device.part_id) if device else None
        if not device or not placement or not part:
            return None
        size = part.footprint.oriented_size(placement.rotation)
        return Rect(x=placement.x, y=placement.y, width=size.width, height=size.height)

    def with_placements(self, placements: Iterable[Placement]) -> "Project":
        data = self.to_dict()
        data["placements"] = [_dump(item) for item in placements]
        return _validate(Project, data)

    def canonical_json(self, indent: Optional[int] = None) -> str:
        return canonical_json(self, indent=indent)


def canonical_json(value: Any, *, indent: Optional[int] = None) -> str:
    """Serialize models and mappings with stable key ordering."""

    if isinstance(value, BaseModel):
        value = _dump(value)
    elif hasattr(value, "to_dict"):
        value = value.to_dict()
    return json.dumps(value, sort_keys=True, ensure_ascii=True, separators=(",", ":"), indent=indent)


def json_schema() -> Dict[str, Any]:
    """Return the public JSON Schema for the canonical EIR document.

    Pydantic remains the single source of truth for field types and required
    fields.  The returned copy is augmented with a stable schema identifier and
    explicit notes for cross-entity rules that JSON Schema cannot express
    (duplicate IDs, terminal references, and geometric collisions); those rules
    are enforced by :mod:`packages.validation` after schema validation.
    """

    # Importing through pydantic.v1 above keeps this output stable on both
    # Pydantic major versions used by the lab.
    schema = copy.deepcopy(Project.schema())
    schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    schema["$id"] = "https://cnb-electrical-lab.local/schema/eir.v1.json"
    schema["title"] = "CNB Electrical Intermediate Representation"
    schema["description"] = (
        "Canonical EIR document. Dimensions and coordinates are millimetres; "
        "semantics, topology, placement, and CAD geometry are separate."
    )
    schema["x-eir-schema-version"] = CURRENT_SCHEMA_VERSION
    schema["x-eir-runtime-rules"] = [
        "IDs are unique within each top-level entity collection.",
        "Connection device/terminal references must resolve to declared entities.",
        "Placements must be inside the enclosure plate and must not overlap.",
        "DIN-mounted devices must attach to a compatible rail and ducts must not collide.",
    ]
    return schema


def schema_json(*, indent: Optional[int] = 2) -> str:
    """Serialize :func:`json_schema` deterministically for distribution."""

    return json.dumps(json_schema(), sort_keys=True, ensure_ascii=True, indent=indent)


def from_json(payload: str | bytes | Mapping[str, Any]) -> Project:
    if isinstance(payload, (str, bytes)):
        payload = json.loads(payload)
    return _validate(Project, payload)
