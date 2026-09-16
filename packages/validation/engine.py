"""Independent validation layer.

The UI can display these issues, but it cannot weaken or bypass them.  Every
issue includes an entity reference and optional geometry evidence so a future
web client can highlight the exact problem.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

from packages.domain_model import Device, Duct, PartDefinition, Placement, Project, Rect


@dataclass(frozen=True)
class ValidationIssue:
    code: str
    severity: str
    entity_id: str
    message: str
    suggested_fix: str = ""
    evidence: Mapping[str, object] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, object]:
        return {
            "code": self.code,
            "severity": self.severity,
            "entity_id": self.entity_id,
            "message": self.message,
            "suggested_fix": self.suggested_fix,
            "evidence": dict(self.evidence),
        }


@dataclass
class ValidationReport:
    issues: List[ValidationIssue] = field(default_factory=list)

    @property
    def errors(self) -> List[ValidationIssue]:
        return [issue for issue in self.issues if issue.severity == "error"]

    @property
    def warnings(self) -> List[ValidationIssue]:
        return [issue for issue in self.issues if issue.severity == "warning"]

    @property
    def valid(self) -> bool:
        return not self.errors

    def to_dict(self) -> Dict[str, object]:
        return {
            "valid": self.valid,
            "errors": len(self.errors),
            "warnings": len(self.warnings),
            "issues": [issue.to_dict() for issue in self.issues],
        }

    def raise_for_errors(self) -> None:
        if self.errors:
            detail = "; ".join(f"{issue.code} {issue.entity_id}: {issue.message}" for issue in self.errors)
            raise ValueError(detail)


def _issue(report: ValidationReport, code: str, severity: str, entity_id: str, message: str, fix: str = "", **evidence: object) -> None:
    report.issues.append(ValidationIssue(code, severity, entity_id, message, fix, evidence))


def _rect_for(project: Project, device: Device, placement: Placement, parts: Mapping[str, PartDefinition]) -> Optional[Rect]:
    part = parts.get(device.part_id)
    if not part:
        return None
    size = part.footprint.oriented_size(placement.rotation)
    return Rect(x=placement.x, y=placement.y, width=size.width, height=size.height)


def _access_rect(rect: Rect, direction: str, depth: float) -> Rect:
    """Return the service corridor outside a component edge."""

    if direction == "left":
        return Rect(x=rect.x - depth, y=rect.y, width=depth, height=rect.height)
    if direction == "right":
        return Rect(x=rect.right, y=rect.y, width=depth, height=rect.height)
    if direction == "top":
        return Rect(x=rect.x, y=rect.top, width=rect.width, height=depth)
    # bottom and front are represented as a bottom-side corridor in the 2D MVP.
    return Rect(x=rect.x, y=rect.y - depth, width=rect.width, height=depth)


def validate_project(project: Project, *, clearance_mm: float = 0.0) -> ValidationReport:
    report = ValidationReport()
    parts = project.part_index()
    devices = project.device_index()
    placements = project.placement_index()
    rails = {rail.id: rail for rail in project.rails}
    ducts = {duct.id: duct for duct in project.ducts}

    # ID/tag and catalog consistency.
    tags: Dict[str, str] = {}
    for device in project.devices:
        if device.tag in tags:
            _issue(report, "E007", "error", device.id, f"duplicate device tag {device.tag!r}", "Rename one of the duplicate device tags.")
        tags[device.tag] = device.id
        if device.part_id not in parts:
            _issue(report, "E009", "error", device.id, f"unknown manufacturer part {device.part_id!r}", "Import the part into the normalized catalog.")
        if device.id not in placements:
            _issue(report, "E010", "error", device.id, "device has no physical footprint placement", "Run auto-layout or add a placement.")
        if not device.terminal_ids and device.part_id in parts and parts[device.part_id].terminals:
            _issue(report, "E011", "warning", device.id, "device has no terminal links despite a terminal-bearing part", "Map logical terminals before exporting wiring.")
        if device.part_id in parts:
            declared = {terminal.id for terminal in parts[device.part_id].terminals}
            unknown_terminals = sorted(set(device.terminal_ids) - declared)
            if unknown_terminals:
                _issue(
                    report,
                    "E008",
                    "error",
                    device.id,
                    f"device maps terminals absent from its part: {', '.join(unknown_terminals)}",
                    "Repair the device terminal map or catalog part definition.",
                    part_id=device.part_id,
                    terminal_ids=unknown_terminals,
                )

    # Physical bounds and pairwise overlap.
    rect_by_device: Dict[str, Rect] = {}
    plate = project.enclosure.plate
    for device in project.devices:
        placement = placements.get(device.id)
        if not placement:
            continue
        rect = _rect_for(project, device, placement, parts)
        if not rect:
            continue
        rect_by_device[device.id] = rect
        if not plate.contains(rect):
            _issue(report, "E001", "error", device.id, "component lies outside the mounting plate", "Move the component inside the enclosure plate bounds.", rect=rect.to_dict(), plate=plate.to_dict())
    ordered = list(rect_by_device.items())
    for index, (left_id, left) in enumerate(ordered):
        for right_id, right in ordered[index + 1 :]:
            if left.intersects(right, clearance=clearance_mm):
                _issue(report, "E002", "error", left_id, f"component overlaps {right_id}", "Move one component or increase the row/duct spacing.", other_entity_id=right_id, left=left.to_dict(), right=right.to_dict(), clearance_mm=clearance_mm)
            left_device = devices[left_id]
            right_device = devices[right_id]
            left_part = parts.get(left_device.part_id)
            right_part = parts.get(right_device.part_id)
            effective_clearance = max(
                clearance_mm,
                left_part.footprint.clearance_mm if left_part else 0.0,
                right_part.footprint.clearance_mm if right_part else 0.0,
            )
            if effective_clearance > 0 and left.intersects(right, clearance=effective_clearance):
                _issue(
                    report,
                    "E004",
                    "error",
                    left_id,
                    f"required clearance to {right_id} is insufficient",
                    "Move components apart or reduce the documented keepout only with evidence.",
                    other_entity_id=right_id,
                    clearance_mm=effective_clearance,
                    left=left.to_dict(),
                    right=right.to_dict(),
                )

    # DIN-rail attachment and rail bounds.
    for device in project.devices:
        placement = placements.get(device.id)
        part = parts.get(device.part_id)
        if not placement or not part or part.footprint.mounting not in ("din_rail", "terminal_rail"):
            continue
        if not placement.rail_id:
            _issue(report, "E003", "error", device.id, "DIN-mounted component is not attached to a rail", "Assign a compatible rail_id.")
            continue
        rail = rails.get(placement.rail_id)
        if not rail:
            _issue(report, "E003", "error", device.id, f"placement references unknown rail {placement.rail_id!r}", "Regenerate rails or repair the rail reference.")
            continue
        rect = rect_by_device.get(device.id)
        if rect and (rect.x < rail.x or rect.right > rail.x + rail.length):
            _issue(report, "E003", "error", device.id, "component extends beyond its DIN rail", "Move the component within the rail length.", rail_id=rail.id)
        expected_y = rail.y + rail.width
        if rect and abs(rect.y - expected_y) > max(5.0, rail.width):
            _issue(report, "E003", "warning", device.id, "component baseline is not aligned to its DIN rail", "Snap the component to the rail baseline.", expected_y=expected_y, actual_y=rect.y)

    # Ducts may touch components at boundaries but should not cross their area.
    for duct in ducts.values():
        duct_rect = duct.rect()
        for device_id, rect in rect_by_device.items():
            if duct_rect.intersects(rect):
                _issue(report, "E006", "error", duct.id, f"duct collides with component {device_id}", "Move the duct corridor or component.", component_id=device_id)

    # MVP terminal/service access: a known face creates a 2D corridor. Unknown
    # metadata is explicitly non-verifiable rather than silently passing.
    for device_id, rect in rect_by_device.items():
        device = devices[device_id]
        part = parts.get(device.part_id)
        footprint = part.footprint if part else None
        if not footprint or not device.terminal_ids:
            continue
        direction = footprint.service_access_direction
        depth = footprint.service_access_depth_mm
        if not direction or direction == "unknown" or not depth:
            _issue(
                report,
                "E005",
                "warning",
                device_id,
                "terminal/service access is not verifiable from part metadata",
                "Document an access face and corridor before authoritative release.",
                access_direction=direction or "unknown",
            )
            continue
        corridor = _access_rect(rect, direction, depth)
        for other_id, other_rect in rect_by_device.items():
            if other_id != device_id and corridor.intersects(other_rect):
                _issue(
                    report,
                    "E005",
                    "error",
                    device_id,
                    f"service access corridor is blocked by {other_id}",
                    "Move the blocking component or document a different access face.",
                    other_entity_id=other_id,
                    access_corridor=corridor.to_dict(),
                )
        for duct_id, duct in ducts.items():
            if corridor.intersects(duct.rect()):
                _issue(
                    report,
                    "E005",
                    "error",
                    device_id,
                    f"service access corridor is blocked by duct {duct_id}",
                    "Move the duct corridor or document a different access face.",
                    duct_id=duct_id,
                    access_corridor=corridor.to_dict(),
                )

    # Connection references and dangling terminals.
    for connection in project.connections:
        from_device = devices.get(connection.from_device)
        to_device = devices.get(connection.to_device)
        if not from_device:
            _issue(report, "E008", "error", connection.id, f"unknown source device {connection.from_device!r}", "Repair the source device reference.")
        if not to_device:
            _issue(report, "E008", "error", connection.id, f"unknown target device {connection.to_device!r}", "Repair the target device reference.")
        if from_device and connection.from_terminal not in from_device.terminal_ids:
            _issue(report, "E008", "error", connection.id, f"source terminal {connection.from_terminal!r} is not declared by {from_device.tag}", "Map the terminal ID or update the part definition.")
        if to_device and connection.to_terminal not in to_device.terminal_ids:
            _issue(report, "E008", "error", connection.id, f"target terminal {connection.to_terminal!r} is not declared by {to_device.tag}", "Map the terminal ID or update the part definition.")

    return report
