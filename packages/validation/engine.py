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
