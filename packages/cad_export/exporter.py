"""Small, dependency-free CAD export layer.

The DXF writer targets conservative ASCII R12 entities (LINE and TEXT), which
are understood by AutoCAD, LibreCAD, ezdxf, and most web viewers.  It is not a
full DWG/DXF implementation; the point of this spike is a valid, auditable
manufacturing interchange for the canonical panel model.
"""

from __future__ import annotations

import html
import json
import math
import tempfile
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

from packages.domain_model import Device, PartDefinition, Placement, Project, Rect, canonical_json


def _fmt(value: float) -> str:
    if abs(value) < 1e-9:
        value = 0.0
    return f"{float(value):.4f}".rstrip("0").rstrip(".") or "0"


def _pair(code: int, value: object) -> str:
    return f"{code}\n{value}\n"


def _line(x1: float, y1: float, x2: float, y2: float, layer: str) -> str:
    return "".join(
        [
            _pair(0, "LINE"),
            _pair(8, layer),
            _pair(10, _fmt(x1)),
            _pair(20, _fmt(y1)),
            _pair(30, "0"),
            _pair(11, _fmt(x2)),
            _pair(21, _fmt(y2)),
            _pair(31, "0"),
        ]
    )


def _text(x: float, y: float, value: str, layer: str, height: float = 8) -> str:
    return "".join(
        [
            _pair(0, "TEXT"),
            _pair(8, layer),
            _pair(10, _fmt(x)),
            _pair(20, _fmt(y)),
            _pair(30, "0"),
            _pair(40, _fmt(height)),
            _pair(1, value.replace("\n", " ")), 
        ]
    )


def _rect_lines(rect: Rect, layer: str) -> str:
    return "".join(
        [
            _line(rect.x, rect.y, rect.right, rect.y, layer),
            _line(rect.right, rect.y, rect.right, rect.top, layer),
            _line(rect.right, rect.top, rect.x, rect.top, layer),
            _line(rect.x, rect.top, rect.x, rect.y, layer),
        ]
    )


def export_dxf(project: Project) -> str:
    """Export a deterministic ASCII DXF R12 document."""

    parts = project.part_index()
    placements = project.placement_index()
    entities: List[str] = []
    enclosure = Rect(x=0, y=0, width=project.enclosure.width, height=project.enclosure.height)
    plate = project.enclosure.plate
    entities.append(_rect_lines(enclosure, "ENCLOSURE"))
    entities.append(_rect_lines(plate, "MOUNTING_PLATE"))
    entities.append(_text(plate.x, plate.top + 15, f"{project.name} [{project.units}]", "ANNOTATION", 10))
    for rail in sorted(project.rails, key=lambda item: item.id):
        if rail.orientation == "vertical":
            entities.append(_line(rail.x, rail.y, rail.x, rail.y + rail.length, "DIN_RAIL"))
        else:
            entities.append(_line(rail.x, rail.y, rail.x + rail.length, rail.y, "DIN_RAIL"))
    for duct in sorted(project.ducts, key=lambda item: item.id):
        entities.append(_rect_lines(duct.rect(), "WIRE_DUCT"))
    for device in sorted(project.devices, key=lambda item: item.id):
        placement = placements.get(device.id)
        part = parts.get(device.part_id)
        if not placement or not part:
            continue
        size = part.footprint.oriented_size(placement.rotation)
        rect = Rect(x=placement.x, y=placement.y, width=size.width, height=size.height)
        entities.append(_rect_lines(rect, "DEVICE"))
        # Keep the legacy DEVICE layer for compatibility while exposing the
        # explicit R2 export contract for downstream CAD consumers.
        entities.append(_rect_lines(rect, "COMPONENT_OUTLINE"))
        entities.append(_line(rect.center.x - min(4.0, rect.width / 4), rect.center.y, rect.center.x + min(4.0, rect.width / 4), rect.center.y, "COMPONENT_DETAIL"))
        entities.append(_line(rect.center.x, rect.center.y - min(4.0, rect.height / 4), rect.center.x, rect.center.y + min(4.0, rect.height / 4), "COMPONENT_DETAIL"))
        entities.append(_text(rect.x + 2, rect.y + min(rect.height - 2, 10), device.tag, "DEVICE_TAG", 6))
        entities.append(_text(rect.x + 2, rect.y + min(rect.height - 10, 3), part.manufacturer_part, "PART_REF", 3))
    for connection in sorted(project.connections, key=lambda item: item.id):
        source = project.footprint_rect(connection.from_device)
        target = project.footprint_rect(connection.to_device)
        if source and target:
            entities.append(_line(source.center.x, source.center.y, target.center.x, target.center.y, "WIRE"))
    header = "".join([_pair(0, "SECTION"), _pair(2, "HEADER"), _pair(9, "$INSUNITS"), _pair(70, 4), _pair(0, "ENDSEC")])
    body = "".join([_pair(0, "SECTION"), _pair(2, "ENTITIES"), *entities, _pair(0, "ENDSEC")])
    return header + body + _pair(0, "EOF")


@dataclass(frozen=True)
class DxfAudit:
    valid: bool
    entity_count: int
    entity_types: Mapping[str, int]
    errors: Tuple[str, ...] = ()
    warnings: Tuple[str, ...] = ()

    def to_dict(self) -> Dict[str, object]:
        result = asdict(self)
        result["entity_types"] = dict(self.entity_types)
        result["errors"] = list(self.errors)
        result["warnings"] = list(self.warnings)
        return result


def audit_with_ezdxf(source: str | bytes | Path) -> Dict[str, object]:
    """Independently parse a DXF with ezdxf when installed.

    The dependency is optional for the core package.  This helper is used by
    the evidence runner to prove that a third-party parser can open the file,
    count entities, and perform ezdxf's own audit pass.
    """

    try:
        import ezdxf  # type: ignore
    except Exception as exc:  # pragma: no cover - depends on environment
        return {"available": False, "error": f"{exc.__class__.__name__}: {exc}"}
    temporary: Optional[tempfile.NamedTemporaryFile] = None
    try:
        if isinstance(source, Path):
            path = source
        elif isinstance(source, bytes) or "\n" in str(source):
            temporary = tempfile.NamedTemporaryFile(suffix=".dxf", delete=False)
            temporary.write(source if isinstance(source, bytes) else str(source).encode("utf-8"))
            temporary.close()
            path = Path(temporary.name)
        else:
            path = Path(str(source))
        drawing = ezdxf.readfile(path)
        modelspace = drawing.modelspace()
        entity_types: Dict[str, int] = {}
        for entity in modelspace:
            entity_types[entity.dxftype()] = entity_types.get(entity.dxftype(), 0) + 1
        auditor = drawing.audit()
        errors = list(getattr(auditor, "errors", []))
        return {
            "available": True,
            "valid": not errors,
            "dxfversion": drawing.dxfversion,
            "modelspace_entity_count": len(modelspace),
            "entity_types": entity_types,
            "audit_error_count": len(errors),
        }
    except Exception as exc:
        return {"available": True, "valid": False, "error": f"{exc.__class__.__name__}: {exc}"}
    finally:
        if temporary is not None:
            try:
                Path(temporary.name).unlink(missing_ok=True)
            except OSError:
                pass


def audit_dxf(source: str | bytes | Path) -> DxfAudit:
    """Audit generated DXF independently of the exporter implementation."""

    if isinstance(source, Path):
        text = source.read_text(encoding="utf-8")
    elif isinstance(source, bytes):
        text = source.decode("utf-8")
    elif "\n" not in source and Path(source).exists():
        text = Path(source).read_text(encoding="utf-8")
    else:
        text = source
    lines = text.replace("\r\n", "\n").replace("\r", "\n").splitlines()
    errors: List[str] = []
    warnings: List[str] = []
    if len(lines) % 2:
        errors.append("DXF group-code/value stream has an odd line count")
    pairs: List[Tuple[str, str]] = list(zip(lines[0::2], lines[1::2]))
    if not pairs or pairs[0] != ("0", "SECTION"):
        errors.append("DXF does not start with SECTION")
    if not pairs or pairs[-1] != ("0", "EOF"):
        errors.append("DXF does not end with EOF")
    entity_types: Dict[str, int] = {}
    in_entities = False
    entity_count = 0
    for code, value in pairs:
        if code == "2" and value == "ENTITIES":
            in_entities = True
            continue
        if in_entities and code == "0" and value == "ENDSEC":
            in_entities = False
            continue
        if in_entities and code == "0":
            entity_types[value] = entity_types.get(value, 0) + 1
            entity_count += 1
            if value not in {"LINE", "TEXT"}:
                warnings.append(f"entity type {value} is outside the R12 spike subset")
    if not entity_count:
        errors.append("ENTITIES section contains no entities")
    # Verify all numeric coordinate fields generated by this spike are finite.
    for code, value in pairs:
        if code in {"10", "20", "30", "11", "21", "31", "40", "70"}:
            try:
                if not math.isfinite(float(value)):
                    errors.append(f"non-finite numeric value {value!r}")
            except ValueError:
                errors.append(f"invalid numeric value {value!r} for group code {code}")
    return DxfAudit(valid=not errors, entity_count=entity_count, entity_types=entity_types, errors=tuple(errors), warnings=tuple(warnings))


def export_svg(project: Project) -> str:
    """Render the same model to a simple inspectable SVG preview."""

    width = project.enclosure.width
    height = project.enclosure.height
    parts = project.part_index()
    placements = project.placement_index()
    # SVG's origin is top-left; transform from mm lower-left coordinates.
    def sy(y: float, h: float = 0) -> float:
        return height - y - h

    elements: List[str] = [
        f'<rect x="0" y="0" width="{_fmt(width)}" height="{_fmt(height)}" fill="#f8fafc" stroke="#0f172a" stroke-width="2"/>',
        f'<rect x="{_fmt(project.enclosure.plate.x)}" y="{_fmt(sy(project.enclosure.plate.y, project.enclosure.plate.height))}" width="{_fmt(project.enclosure.plate.width)}" height="{_fmt(project.enclosure.plate.height)}" fill="#ffffff" stroke="#64748b" stroke-width="1"/>',
    ]
    for rail in sorted(project.rails, key=lambda item: item.id):
        if rail.orientation == "vertical":
            elements.append(f'<line x1="{_fmt(rail.x)}" y1="{_fmt(sy(rail.y + rail.length))}" x2="{_fmt(rail.x)}" y2="{_fmt(sy(rail.y))}" stroke="#b45309" stroke-width="5"/>')
        else:
            elements.append(f'<line x1="{_fmt(rail.x)}" y1="{_fmt(sy(rail.y))}" x2="{_fmt(rail.x + rail.length)}" y2="{_fmt(sy(rail.y))}" stroke="#b45309" stroke-width="5"/>')
    for duct in sorted(project.ducts, key=lambda item: item.id):
        elements.append(f'<rect x="{_fmt(duct.x)}" y="{_fmt(sy(duct.y, duct.height))}" width="{_fmt(duct.width)}" height="{_fmt(duct.height)}" fill="#dbeafe" fill-opacity="0.65" stroke="#2563eb" stroke-width="1"/>')
    for device in sorted(project.devices, key=lambda item: item.id):
        placement = placements.get(device.id)
        part = parts.get(device.part_id)
        if not placement or not part:
            continue
        size = part.footprint.oriented_size(placement.rotation)
        fill = "#fee2e2" if part.category == "breaker" else "#dcfce7" if part.category in {"contactor", "overload"} else "#fef3c7" if part.category == "terminal" else "#ede9fe"
        elements.append(f'<rect data-device-id="{html.escape(device.id)}" x="{_fmt(placement.x)}" y="{_fmt(sy(placement.y, size.height))}" width="{_fmt(size.width)}" height="{_fmt(size.height)}" rx="2" fill="{fill}" stroke="#111827" stroke-width="1"/>')
        elements.append(f'<text x="{_fmt(placement.x + 2)}" y="{_fmt(sy(placement.y + size.height / 2))}" font-size="8" font-family="sans-serif">{html.escape(device.tag)}</text>')
    for connection in sorted(project.connections, key=lambda item: item.id):
        source = project.footprint_rect(connection.from_device)
        target = project.footprint_rect(connection.to_device)
        if source and target:
            elements.append(f'<line x1="{_fmt(source.center.x)}" y1="{_fmt(sy(source.center.y))}" x2="{_fmt(target.center.x)}" y2="{_fmt(sy(target.center.y))}" stroke="#64748b" stroke-width="1" stroke-dasharray="4 3"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {_fmt(width)} {_fmt(height)}" width="{_fmt(width)}mm" height="{_fmt(height)}mm">' + "".join(elements) + "</svg>"


def write_project_artifacts(project: Project, out_dir: str | Path, stem: Optional[str] = None) -> Dict[str, Path]:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    name = stem or project.id
    json_path = out / f"{name}.json"
    dxf_path = out / f"{name}.dxf"
    svg_path = out / f"{name}.svg"
    audit_path = out / f"{name}.dxf.audit.json"
    json_path.write_text(project.canonical_json(indent=2), encoding="utf-8")
    dxf = export_dxf(project)
    dxf_path.write_text(dxf, encoding="utf-8")
    svg_path.write_text(export_svg(project), encoding="utf-8")
    audit_path.write_text(json.dumps(audit_dxf(dxf).to_dict(), indent=2, sort_keys=True), encoding="utf-8")
    return {"json": json_path, "dxf": dxf_path, "svg": svg_path, "audit": audit_path}
