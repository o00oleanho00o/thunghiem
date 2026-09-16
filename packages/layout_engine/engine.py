"""Panel auto-layout engines.

The heuristic is always available and is intentionally transparent.  The
CP-SAT implementation is an optional accelerator: when ``ortools`` is not
installed the same API falls back to the heuristic and records that fact in
the result metadata instead of silently claiming a solver run.
"""

from __future__ import annotations

import math
import time
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

from packages.domain_model import (
    Device,
    Duct,
    PartDefinition,
    Placement,
    Project,
    Rail,
    Rect,
    stable_id,
)


@dataclass(frozen=True)
class LayoutConfig:
    grid_mm: int = 5
    margin_mm: float = 40.0
    row_gap_mm: float = 80.0
    duct_width_mm: float = 40.0
    edge_duct_width_mm: float = 45.0
    rail_length_margin_mm: float = 90.0
    solver_time_limit_s: float = 8.0
    connection_weight: int = 1
    target_weight: int = 2


class LayoutCapacityError(ValueError):
    """Raised when deterministic row/rail capacity cannot fit the enclosure."""


@dataclass
class LayoutResult:
    project: Project
    engine: str
    elapsed_ms: float
    metrics: Dict[str, float] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)

    @property
    def placement_count(self) -> int:
        return len(self.project.placements)


def _part_map(project: Project, catalog: Optional[object]) -> Dict[str, PartDefinition]:
    parts = project.part_index()
    if catalog is not None and hasattr(catalog, "all"):
        for part in catalog.all():
            parts.setdefault(part.id, part)
    return parts


def _copy_project(project: Project) -> Project:
    if hasattr(project, "model_copy"):
        return project.model_copy(deep=True)  # type: ignore[attr-defined]
    return project.copy(deep=True)


def _snap(value: float, grid: int) -> float:
    return float(round(value / grid) * grid)


def _device_rect(device: Device, placement: Placement, parts: Mapping[str, PartDefinition]) -> Rect:
    part = parts[device.part_id]
    size = part.footprint.oriented_size(placement.rotation)
    return Rect(x=placement.x, y=placement.y, width=size.width, height=size.height)


def _category_priority(device: Device, part: PartDefinition) -> Tuple[int, str, str]:
    category = part.category.lower()
    priorities = {
        "breaker": 0,
        "power_supply": 1,
        "contactor": 2,
        "overload": 3,
        "plc": 4,
        "relay": 5,
        "terminal": 9,
        "accessory": 10,
    }
    return priorities.get(category, 6), device.function, device.tag


def _group_for(device: Device, part: PartDefinition) -> str:
    category = part.category.lower()
    if category in {"terminal"}:
        return "terminals"
    if category in {"breaker", "contactor", "overload"} or device.function.lower() in {"power", "motor"}:
        return "power"
    if category in {"plc", "relay", "power_supply"} or device.function.lower() in {"control", "plc"}:
        return "control"
    return "auxiliary"


def _build_rails_and_ducts(
    project: Project,
    din_devices: Sequence[Tuple[Device, PartDefinition]],
    backplate_devices: Sequence[Tuple[Device, PartDefinition]],
    config: LayoutConfig,
) -> Tuple[List[Rail], List[Duct], Dict[str, List[Rail]]]:
    plate = project.enclosure.plate
    groups: Dict[str, List[Tuple[Device, PartDefinition]]] = {"power": [], "control": [], "terminals": [], "auxiliary": []}
    for item in din_devices:
        groups[_group_for(*item)].append(item)

    # Rows are deliberately separated by horizontal duct corridors.  This is
    # a physical design choice, not merely a drawing convenience.
    max_h = max((part.footprint.height for _, part in din_devices), default=80.0)
    row_pitch = max(max_h + config.row_gap_mm, 180.0)
    order = [name for name in ("power", "control", "auxiliary", "terminals") if groups[name]]
    # A group may need several physical rails.  Computing this before placing
    # anything prevents an overflow rail from being inserted on top of the
    # next group's devices (the first implementation exposed that bug on the
    # six-motor scenario).
    rail_length = max(100.0, plate.width - 2 * config.rail_length_margin_mm)
    rail_counts: Dict[str, int] = {}
    for group in order:
        # Sequential first-fit binning mirrors the actual placement cursor and
        # avoids under-counting when item widths fragment a rail.
        bins = 1
        cursor = 0.0
        for _, part in groups[group]:
            item_width = part.footprint.width + config.grid_mm + (part.footprint.clearance_mm or 0.0)
            if cursor and cursor + item_width > rail_length:
                bins += 1
                cursor = 0.0
            cursor += item_width
        rail_counts[group] = bins
    row_count = max(1, sum(rail_counts.values()))
    y_start = plate.y + config.margin_mm + (0 if "terminals" in order else config.duct_width_mm)
    # Keep the topmost row inside the plate; terminal rows remain near the
    # bottom, while power/control rows are stacked above them.
    top_reserved = max((part.footprint.height for _, part in backplate_devices), default=0.0)
    top_reserved += config.row_gap_mm if top_reserved else 0.0
    max_last_rail_y = plate.top - config.margin_mm - top_reserved - config.duct_width_mm - max_h
    if row_count == 1 and y_start > max_last_rail_y:
        raise LayoutCapacityError(
            f"DIN rail row starts at {y_start:.1f} mm but available top boundary is {max_last_rail_y:.1f} mm"
        )
    if row_count > 1:
        available_pitch = (max_last_rail_y - y_start) / (row_count - 1)
        minimum_pitch = max_h + config.duct_width_mm + 10.0
        if available_pitch < minimum_pitch:
            raise LayoutCapacityError(
                f"{row_count} DIN rail rows require at least {minimum_pitch:.1f} mm pitch, "
                f"but enclosure provides {available_pitch:.1f} mm"
            )
        row_pitch = min(row_pitch, available_pitch)

    rails: List[Rail] = []
    rails_by_group: Dict[str, List[Rail]] = {group: [] for group in order}
    row_index = 0
    for group in order:
        for rail_index in range(rail_counts[group]):
            y = math.floor((y_start + row_index * row_pitch) / config.grid_mm) * config.grid_mm
            row_index += 1
            rail = Rail(
                id=stable_id("rail", project.id, group, rail_index),
                x=_snap(plate.x + config.rail_length_margin_mm, config.grid_mm),
                y=y,
                length=rail_length,
                width=35,
            )
            rails.append(rail)
            rails_by_group[group].append(rail)

    ducts: List[Duct] = []
    # Vertical edge ducts and horizontal corridors.  Device placement leaves
    # these corridors visible in SVG/DXF output and reserves service space.
    ducts.append(Duct(id=stable_id("duct", project.id, "left"), x=plate.x, y=plate.y, width=config.edge_duct_width_mm, height=plate.height))
    ducts.append(Duct(id=stable_id("duct", project.id, "right"), x=plate.right - config.edge_duct_width_mm, y=plate.y, width=config.edge_duct_width_mm, height=plate.height))
    for index in range(max(0, row_count - 1)):
        # Leave the full component envelope above the lower rail and below the
        # next rail.  A midpoint corridor would cut through tall devices.
        gap = row_pitch - max_h
        y = _snap(y_start + index * row_pitch + 35.0 + max_h + (gap - config.duct_width_mm) / 2, config.grid_mm)
        if plate.y < y < plate.top - config.duct_width_mm:
            ducts.append(Duct(id=stable_id("duct", project.id, "h", index), x=plate.x, y=y, width=plate.width, height=config.duct_width_mm))
    return rails, ducts, rails_by_group


def heuristic_layout(project: Project, catalog: Optional[object] = None, config: LayoutConfig = LayoutConfig()) -> LayoutResult:
    started = time.perf_counter()
    result = _copy_project(project)
    parts = _part_map(result, catalog)
    missing = sorted({device.part_id for device in result.devices if device.part_id not in parts})
    if missing:
        raise ValueError(f"layout requires footprints for: {', '.join(missing)}")

    din_devices: List[Tuple[Device, PartDefinition]] = []
    backplate_devices: List[Tuple[Device, PartDefinition]] = []
    for device in result.devices:
        part = parts[device.part_id]
        if part.footprint.mounting in ("din_rail", "terminal_rail"):
            din_devices.append((device, part))
        else:
            backplate_devices.append((device, part))
    din_devices.sort(key=lambda item: _category_priority(*item))
    backplate_devices.sort(key=lambda item: _category_priority(*item))
    rails, ducts, rails_by_group = _build_rails_and_ducts(result, din_devices, backplate_devices, config)

    placements: List[Placement] = []
    cursor_x: Dict[str, float] = {group: group_rails[0].x for group, group_rails in rails_by_group.items()}
    rail_index_by_group: Dict[str, int] = {group: 0 for group in rails_by_group}

    for device, part in din_devices:
        group = _group_for(device, part)
        group_rails = rails_by_group[group]
        rail_index = rail_index_by_group[group]
        rail = group_rails[rail_index]
        width = part.footprint.width
        height = part.footprint.height
        x = cursor_x[group]
        if x + width > rail.x + rail.length and rail_index + 1 < len(group_rails):
            rail_index += 1
            rail_index_by_group[group] = rail_index
            rail = group_rails[rail_index]
            cursor_x[group] = rail.x
            x = cursor_x[group]
        placement_y = _snap(rail.y + rail.width, config.grid_mm)
        placements.append(Placement(device_id=device.id, x=_snap(x, config.grid_mm), y=placement_y, rail_id=rail.id, zone=group))
        cursor_x[group] = x + width + config.grid_mm + (part.footprint.clearance_mm or 0.0)

    # Backplate parts are placed at the top-left, descending in columns.
    plate = result.enclosure.plate
    back_x = plate.x + config.edge_duct_width_mm + config.margin_mm
    back_y = plate.top - config.margin_mm
    column_width = 0.0
    for device, part in backplate_devices:
        width = part.footprint.width
        height = part.footprint.height
        if back_y - height < plate.y + config.margin_mm:
            back_x += column_width + config.row_gap_mm
            back_y = plate.top - config.margin_mm
            column_width = 0.0
        x = _snap(back_x, config.grid_mm)
        y = _snap(back_y - height, config.grid_mm)
        placements.append(Placement(device_id=device.id, x=x, y=y, zone="backplate"))
        back_y = y - config.grid_mm
        column_width = max(column_width, width)

    # Preserve explicit locked placements supplied by an engineer.  Locked
    # devices are validated, not moved by an auto-layout run.
    existing = result.placement_index()
    for placement in result.placements:
        if placement.locked:
            placements = [p for p in placements if p.device_id != placement.device_id]
            placements.append(placement)

    result.rails = rails
    result.ducts = ducts
    result.placements = sorted(placements, key=lambda item: item.device_id)
    elapsed = (time.perf_counter() - started) * 1000
    metrics = _layout_metrics(result, parts)
    metrics["elapsed_ms"] = round(elapsed, 3)
    metrics["component_count"] = float(len(result.devices))
    return LayoutResult(project=result, engine="heuristic", elapsed_ms=elapsed, metrics=metrics)


def _layout_metrics(project: Project, parts: Mapping[str, PartDefinition]) -> Dict[str, float]:
    rects = [project.footprint_rect(device.id) for device in project.devices]
    rects = [rect for rect in rects if rect is not None]
    overlaps = 0
    for index, left in enumerate(rects):
        for right in rects[index + 1 :]:
            if left.intersects(right):
                overlaps += 1
    plate = project.enclosure.plate
    used = sum(rect.width * rect.height for rect in rects)
    return {
        "overlap_pairs": float(overlaps),
        "used_area_mm2": round(used, 3),
        "plate_area_mm2": round(plate.width * plate.height, 3),
        "space_utilization_percent": round(100 * used / (plate.width * plate.height), 3),
    }


def solver_layout(project: Project, catalog: Optional[object] = None, config: LayoutConfig = LayoutConfig()) -> LayoutResult:
    """Solve coarse placement with OR-Tools CP-SAT when available.

    This is intentionally a bounded spike.  The model uses integer millimetres,
    no-overlap rectangles, enclosure bounds, and target-distance objectives.
    Rail attachment is represented by allowed Y coordinates generated by the
    heuristic.  A missing OR-Tools installation is an explicit fallback, not a
    fake solver result.
    """

    baseline = heuristic_layout(project, catalog=catalog, config=config)
    try:
        from ortools.sat.python import cp_model  # type: ignore
    except Exception as exc:  # pragma: no cover - exercised in dependency-light envs
        baseline.engine = "solver-fallback-heuristic"
        baseline.warnings.append(f"OR-Tools unavailable: {exc.__class__.__name__}: {exc}")
        return baseline

    started = time.perf_counter()
    solved = _copy_project(baseline.project)
    parts = _part_map(solved, catalog)
    plate = solved.enclosure.plate
    model = cp_model.CpModel()
    xvars: Dict[str, object] = {}
    yvars: Dict[str, object] = {}
    xends: Dict[str, object] = {}
    yends: Dict[str, object] = {}
    rect_intervals_x = []
    rect_intervals_y = []
    targets: Dict[str, Tuple[int, int]] = {}
    rail_ys = sorted({int(round(rail.y + rail.width)) for rail in solved.rails})

    for device in solved.devices:
        part = parts[device.part_id]
        placement = solved.placement_index().get(device.id)
        if not placement:
            continue
        width = int(round(part.footprint.width))
        height = int(round(part.footprint.height))
        x = model.NewIntVar(int(math.ceil(plate.x)), int(math.floor(plate.right - width)), f"x_{device.id}")
        y = model.NewIntVar(int(math.ceil(plate.y)), int(math.floor(plate.top - height)), f"y_{device.id}")
        if placement.locked:
            model.Add(x == int(round(placement.x)))
            model.Add(y == int(round(placement.y)))
        elif part.footprint.mounting in ("din_rail", "terminal_rail") and rail_ys:
            # Keep the deterministic rail assignment as a hard physical
            # constraint.  Letting CP-SAT move a device to an arbitrary rail
            # while retaining its old rail_id creates an invalid EIR and can
            # make a visually plausible but unmanufacturable result.
            assigned_rail = next((rail for rail in solved.rails if rail.id == placement.rail_id), None)
            if assigned_rail is not None:
                model.Add(y == int(round(placement.y)))
                model.Add(x >= int(round(assigned_rail.x)))
                model.Add(x <= int(round(assigned_rail.x + assigned_rail.length - width)))
            else:
                allowed = [value for value in rail_ys if value + height <= plate.top]
                if allowed:
                    model.AddAllowedAssignments([y], [(value,) for value in allowed])
        elif part.footprint.mounting == "backplate":
            # Backplate devices are deliberately kept at their deterministic
            # top-left anchor in this coarse spike; a future placement model
            # can add explicit keep-out intervals for ducts and service zones.
            model.Add(x == int(round(placement.x)))
            model.Add(y == int(round(placement.y)))
        xe = model.NewIntVar(int(math.ceil(plate.x)), int(math.ceil(plate.right)), f"xe_{device.id}")
        ye = model.NewIntVar(int(math.ceil(plate.y)), int(math.ceil(plate.top)), f"ye_{device.id}")
        model.Add(xe == x + width)
        model.Add(ye == y + height)
        rect_intervals_x.append(model.NewIntervalVar(x, width, xe, f"ix_{device.id}"))
        rect_intervals_y.append(model.NewIntervalVar(y, height, ye, f"iy_{device.id}"))
        xvars[device.id] = x
        yvars[device.id] = y
        xends[device.id] = xe
        yends[device.id] = ye
        targets[device.id] = (int(round(placement.x)), int(round(placement.y)))
    if rect_intervals_x:
        model.AddNoOverlap2D(rect_intervals_x, rect_intervals_y)

    objective_terms = []
    for device_id, (target_x, target_y) in targets.items():
        dx = model.NewIntVar(0, int(max(plate.width, plate.height) * 2), f"dx_{device_id}")
        dy = model.NewIntVar(0, int(max(plate.width, plate.height) * 2), f"dy_{device_id}")
        model.AddAbsEquality(dx, xvars[device_id] - target_x)
        model.AddAbsEquality(dy, yvars[device_id] - target_y)
        objective_terms.extend([config.target_weight * dx, config.target_weight * dy])

    # Approximate connection wire length by center-to-center Manhattan distance.
    for index, connection in enumerate(solved.connections):
        if connection.from_device not in xvars or connection.to_device not in xvars:
            continue
        from_device = solved.device_index()[connection.from_device]
        to_device = solved.device_index()[connection.to_device]
        from_part = parts[from_device.part_id]
        to_part = parts[to_device.part_id]
        offset_x = int(round((from_part.footprint.width - to_part.footprint.width) / 2))
        offset_y = int(round((from_part.footprint.height - to_part.footprint.height) / 2))
        dx = model.NewIntVar(0, int(max(plate.width, plate.height) * 2), f"cdx_{index}")
        dy = model.NewIntVar(0, int(max(plate.width, plate.height) * 2), f"cdy_{index}")
        model.AddAbsEquality(dx, xvars[connection.from_device] - xvars[connection.to_device] + offset_x)
        model.AddAbsEquality(dy, yvars[connection.from_device] - yvars[connection.to_device] + offset_y)
        objective_terms.extend([config.connection_weight * dx, config.connection_weight * dy])
    if objective_terms:
        model.Minimize(sum(objective_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = config.solver_time_limit_s
    solver.parameters.num_search_workers = 1
    status = solver.Solve(model)
    status_name = solver.StatusName(status)
    if status_name not in {"OPTIMAL", "FEASIBLE"}:
        baseline.engine = f"solver-{status_name.lower()}-fallback"
        baseline.warnings.append(f"CP-SAT status {status_name}; retained heuristic placements")
        return baseline
    placements: List[Placement] = []
    baseline_by_device = solved.placement_index()
    for device in solved.devices:
        old = baseline_by_device.get(device.id)
        if not old or device.id not in xvars:
            continue
        placements.append(old.copy(update={"x": float(solver.Value(xvars[device.id])), "y": float(solver.Value(yvars[device.id]))}))
    solved.placements = sorted(placements, key=lambda item: item.device_id)
    elapsed = (time.perf_counter() - started) * 1000
    metrics = _layout_metrics(solved, parts)
    metrics.update({"elapsed_ms": round(elapsed, 3), "solver_objective": float(solver.ObjectiveValue()), "component_count": float(len(solved.devices))})
    return LayoutResult(project=solved, engine=f"ortools-cp-sat-{status_name.lower()}", elapsed_ms=elapsed, metrics=metrics)
