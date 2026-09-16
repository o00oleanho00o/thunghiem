"""Normalized manufacturer-part catalog and deterministic seed data.

The seed catalog is intentionally composed of plausible generic parts rather
than copied manufacturer drawings.  It proves the model and workflow without
creating a licensing dependency on vendor data portals.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Optional

from packages.domain_model import Device, Footprint, PartDefinition, Terminal, stable_id


class CatalogError(ValueError):
    pass


class ComponentCatalog:
    def __init__(self, parts: Iterable[PartDefinition] = ()) -> None:
        self._parts: Dict[str, PartDefinition] = {}
        self._aliases: Dict[str, str] = {}
        for part in parts:
            self.register(part)

    def register(self, part: PartDefinition) -> PartDefinition:
        if part.id in self._parts:
            raise CatalogError(f"duplicate catalog part id: {part.id}")
        self._parts[part.id] = part
        for alias in [part.id, part.manufacturer_part, *part.aliases]:
            self._aliases[alias.lower()] = part.id
        return part

    def get(self, part_id: str) -> PartDefinition:
        canonical = self._aliases.get(part_id.lower(), part_id)
        try:
            return self._parts[canonical]
        except KeyError as exc:
            raise CatalogError(f"unknown manufacturer part: {part_id}") from exc

    def maybe_get(self, part_id: str) -> Optional[PartDefinition]:
        try:
            return self.get(part_id)
        except CatalogError:
            return None

    def all(self) -> List[PartDefinition]:
        return [self._parts[key] for key in sorted(self._parts)]

    def __len__(self) -> int:
        return len(self._parts)

    def instantiate(
        self,
        part_id: str,
        tag: str,
        *,
        function: str = "general",
        location: str = "cabinet",
        description: Optional[str] = None,
        properties: Optional[Mapping[str, str]] = None,
        instance_key: Optional[str] = None,
    ) -> Device:
        part = self.get(part_id)
        device_id = stable_id("device", instance_key or tag, part.id)
        terminal_ids = [terminal.id for terminal in part.terminals]
        return Device(
            id=device_id,
            tag=tag,
            part_id=part.id,
            function=function,
            location=location,
            description=description or part.description,
            terminal_ids=terminal_ids,
            properties=dict(properties or {}),
        )

    def to_dict(self) -> Dict[str, object]:
        return {part.id: part.to_dict() for part in self.all()}

    def to_json(self, *, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, sort_keys=True, ensure_ascii=True)


def _part(
    part_id: str,
    mpn: str,
    description: str,
    category: str,
    width: float,
    height: float,
    depth: float,
    mounting: str,
    terminals: Iterable[tuple[str, str, str]],
    *,
    ratings: Optional[Mapping[str, str]] = None,
    aliases: Iterable[str] = (),
) -> PartDefinition:
    return PartDefinition(
        id=part_id,
        manufacturer="CNB-GENERIC",
        manufacturer_part=mpn,
        description=description,
        category=category,
        footprint=Footprint(
            width=width,
            height=height,
            depth=depth,
            mounting=mounting,  # type: ignore[arg-type]
            rail_width=35 if mounting == "din_rail" else None,
            keepout_left=3,
            keepout_right=3,
            keepout_top=3,
            keepout_bottom=3,
        ),
        terminals=[Terminal(id=tid, name=name, kind=kind) for tid, name, kind in terminals],
        ratings=dict(ratings or {}),
        symbol_ref=f"symbols/{category}/{part_id}",
        footprint_ref=f"footprints/{part_id}",
        aliases=list(aliases),
    )


def seed_catalog() -> ComponentCatalog:
    """Return generic parts sufficient for three realistic demo panels."""

    parts = [
        _part("MCCB_MAIN_250A", "CNB-MCCB-250", "Main molded-case circuit breaker 250 A", "breaker", 105, 160, 90, "backplate", [("L1", "Line 1", "power"), ("L2", "Line 2", "power"), ("L3", "Line 3", "power"), ("T1", "Load 1", "power"), ("T2", "Load 2", "power"), ("T3", "Load 3", "power")], ratings={"current": "250A", "poles": "3"}),
        _part("MCB_3P_16A", "CNB-MCB-3P-16", "Three-pole miniature circuit breaker 16 A", "breaker", 54, 80, 72, "din_rail", [("L1", "Line 1", "power"), ("L2", "Line 2", "power"), ("L3", "Line 3", "power"), ("T1", "Load 1", "power"), ("T2", "Load 2", "power"), ("T3", "Load 3", "power")], ratings={"current": "16A", "poles": "3"}),
        _part("MCB_1P_6A", "CNB-MCB-1P-6", "Single-pole control miniature circuit breaker 6 A", "breaker", 18, 80, 72, "din_rail", [("L", "Line", "power"), ("T", "Load", "power")], ratings={"current": "6A", "poles": "1"}),
        _part("CONTACTOR_15KW", "CNB-CON-15KW", "Contactor for 15 kW motor starter", "contactor", 45, 85, 80, "din_rail", [("L1", "Line 1", "power"), ("L2", "Line 2", "power"), ("L3", "Line 3", "power"), ("T1", "Load 1", "power"), ("T2", "Load 2", "power"), ("T3", "Load 3", "power"), ("A1", "Coil +", "control"), ("A2", "Coil -", "control")], ratings={"power": "15kW"}),
        _part("OVERLOAD_15KW", "CNB-OL-15KW", "Thermal overload relay for 15 kW motor", "overload", 45, 75, 70, "din_rail", [("L1", "Line 1", "power"), ("L2", "Line 2", "power"), ("L3", "Line 3", "power"), ("T1", "Load 1", "power"), ("T2", "Load 2", "power"), ("T3", "Load 3", "power"), ("95", "Trip NC", "control"), ("96", "Trip NC", "control")], ratings={"power": "15kW"}),
        _part("PSU_24V_120W", "CNB-PSU-24-120", "24 VDC control power supply 120 W", "power_supply", 72, 100, 90, "din_rail", [("L", "Line", "power"), ("N", "Neutral", "power"), ("PE", "Earth", "protective_earth"), ("+24", "+24 V", "control"), ("0V", "0 V", "control")], ratings={"output": "24VDC 5A"}),
        _part("PLC_CPU", "CNB-PLC-CPU", "Compact PLC CPU", "plc", 90, 100, 80, "din_rail", [("+24", "+24 V", "control"), ("0V", "0 V", "control"), ("DI_COM", "DI common", "signal"), ("DO_COM", "DO common", "signal")]),
        _part("PLC_IO_16", "CNB-PLC-IO16", "16-channel PLC I/O module", "plc", 90, 100, 80, "din_rail", [("+24", "+24 V", "control"), ("0V", "0 V", "control"), ("I1", "Input 1", "signal"), ("O1", "Output 1", "signal")]),
        _part("RELAY_4CO", "CNB-RELAY-4CO", "Four changeover interface relay", "relay", 18, 80, 70, "din_rail", [("A1", "Coil +", "control"), ("A2", "Coil -", "control"), ("11", "COM", "signal"), ("14", "NO", "signal")]),
        _part("TERMINAL_4MM", "CNB-TERM-4", "Feed-through terminal 4 mm2", "terminal", 6, 55, 42, "din_rail", [("1", "Terminal", "generic")]),
        _part("DIN_RAIL_35", "CNB-DIN-35", "35 mm DIN rail", "accessory", 500, 7, 35, "backplate", [], aliases=("din-rail",)),
    ]
    return ComponentCatalog(parts)


def catalog_from_json(path: str | Path) -> ComponentCatalog:
    """Load a catalog exported by :meth:`ComponentCatalog.to_json`."""

    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    items = raw.values() if isinstance(raw, dict) else raw
    return ComponentCatalog(PartDefinition.parse_obj(item) for item in items)


def catalog_from_csv(path: str | Path) -> ComponentCatalog:
    """Load a deliberately small interchange CSV.

    CSV is intended for a BOM ingestion spike, not as the canonical catalog
    format.  The richer JSON/Pydantic form remains authoritative.
    """

    parts: List[PartDefinition] = []
    with Path(path).open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            parts.append(
                _part(
                    row["id"],
                    row.get("manufacturer_part", row["id"]),
                    row.get("description", row["id"]),
                    row.get("category", "generic"),
                    float(row["width_mm"]),
                    float(row["height_mm"]),
                    float(row.get("depth_mm", 50)),
                    row.get("mounting", "free"),
                    (),
                )
            )
    return ComponentCatalog(parts)

