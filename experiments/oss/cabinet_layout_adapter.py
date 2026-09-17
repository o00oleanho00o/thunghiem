"""CNB EIR -> Taam4142/cabinet-layout-generator POC adapter.

The adapter is intentionally a one-way projection.  EIR remains the source of
truth; the OSS model is a disposable editor/export representation.  Cabinet
Layout Generator has no first-class rail collection, so rails are represented
as locked visual elements and the result records that limitation explicitly.

Usage (from the repository root)::

    python experiments/oss/cabinet_layout_adapter.py \
      --input examples/plc-panel/project.json \
      --output evidence/r4-3/poc1-cabinet-layout-model.json \
      --export-dir evidence/r4-3/poc1-cabinet-layout
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
OSS_SERVICE = (
    REPO_ROOT
    / "research"
    / "cloned-or-scripted-spikes"
    / "cabinet-layout-generator"
    / "service"
)
sys.path.insert(0, str(OSS_SERVICE))


def _number(value: Any, fallback: float = 0.0) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return fallback
    return result if result == result and abs(result) != float("inf") else fallback


def _part_index(eir: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {part["id"]: part for part in eir.get("parts", [])}


def _placement_index(eir: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {placement["device_id"]: placement for placement in eir.get("placements", [])}


def _to_top_left_y(y_lower: float, height: float, margin: float, plate_height: float) -> float:
    """Convert EIR lower-left coordinates to OSS top-left coordinates."""

    return round(plate_height - ((y_lower - margin) + height), 4)


def project_to_oss(eir: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    enclosure = eir["enclosure"]
    margin = _number(enclosure.get("plate_margin"), 0)
    enclosure_width = _number(enclosure["width"])
    enclosure_height = _number(enclosure["height"])
    plate_width = enclosure_width - 2 * margin
    plate_height = enclosure_height - 2 * margin

    parts = _part_index(eir)
    placements = _placement_index(eir)
    library: dict[str, dict[str, Any]] = {}
    elements: list[dict[str, Any]] = []
    unsupported: list[dict[str, Any]] = []

    for device in eir.get("devices", []):
        part = parts.get(device.get("part_id"), {})
        footprint = part.get("footprint", {})
        key = f"eir_{part.get('id', device.get('part_id', device['id']))}"
        width = _number(footprint.get("width"), 40)
        height = _number(footprint.get("height"), 30)
        library.setdefault(
            key,
            {
                "lib_key": key,
                "source": "rect",
                "name": part.get("description", device.get("description", key)),
                "width_mm": width,
                "height_mm": height,
                "confirm": False,
                "band": 2 if part.get("category") == "plc" else 1,
            },
        )
        placement = placements.get(device["id"], {})
        rotation = int(placement.get("rotation", 0)) % 360
        x = _number(placement.get("x"), margin) - margin
        y = _to_top_left_y(_number(placement.get("y"), margin), height, margin, plate_height)
        elements.append(
            {
                "id": device["id"],
                "lib_key": key,
                "tag": device.get("tag", device["id"]),
                "x_mm": round(x, 4),
                "y_mm": round(y, 4),
                "rot_deg": rotation,
                "gap_before_mm": 0.1,
                "clearance_to_duct_mm": 3,
                "group_id": None,
                "locked": bool(placement.get("locked", False)),
                "metadata": {
                    "eir_device_id": device["id"],
                    "part_id": device.get("part_id"),
                    "rail_id": placement.get("rail_id"),
                    "mounting": footprint.get("mounting"),
                },
            }
        )

    # Cabinet Layout Generator currently stores ducts but not DIN rails.  A
    # locked visual rectangle keeps the POC renderable without claiming rail
    # semantics that the OSS model does not provide.
    for rail in eir.get("rails", []):
        key = f"__rail_{rail['id']}"
        width = _number(rail.get("length"), plate_width)
        height = _number(rail.get("width"), 7.5)
        library[key] = {
            "lib_key": key,
            "source": "rect",
            "name": f"DIN rail {rail['id']} (visual proxy)",
            "width_mm": width,
            "height_mm": height,
            "confirm": False,
        }
        x = _number(rail.get("x"), margin) - margin
        y = _to_top_left_y(_number(rail.get("y"), margin), height, margin, plate_height)
        elements.append(
            {
                "id": key,
                "lib_key": key,
                "tag": rail["id"],
                "x_mm": round(x, 4),
                "y_mm": round(y, 4),
                "rot_deg": 0 if rail.get("orientation", "horizontal") == "horizontal" else 90,
                "gap_before_mm": 0,
                "clearance_to_duct_mm": 0,
                "group_id": None,
                "locked": True,
                "metadata": {"eir_rail_id": rail["id"], "representation": "visual-proxy"},
            }
        )

    ducts: list[dict[str, Any]] = []
    for duct in eir.get("ducts", []):
        x = _number(duct.get("x"), margin) - margin
        y_lower = _number(duct.get("y"), margin)
        width = _number(duct.get("width"), 40)
        height = _number(duct.get("height"), 100)
        horizontal = width > height
        ducts.append(
            {
                "id": duct["id"],
                "x_mm": round(x, 4),
                "y_mm": _to_top_left_y(y_lower, height, margin, plate_height),
                "length_mm": height if not horizontal else width,
                "width_mm": width if not horizontal else height,
                "label_h_mm": height if not horizontal else width,
                "rot_deg": 0 if horizontal else 90,
            }
        )

    if eir.get("connections"):
        unsupported.append(
            {
                "capability": "topology/connections",
                "reason": "cabinet-layout-generator model has no connection collection; preserved in EIR only",
                "count": len(eir["connections"]),
            }
        )

    model = {
        "project": {
            "id": eir.get("id", "cnb-eir"),
            "name": eir.get("name", "CNB EIR panel") + " · OSS POC",
            "panel_tag": eir.get("id", "cnb-eir"),
            "rev": "POC",
        },
        "plate": {"width_mm": plate_width, "height_mm": plate_height, "origin": "top_left"},
        "defaults": {"gap_between_equipment_mm": 0.1, "clearance_equipment_to_duct_mm": 3},
        "ducts": ducts,
        "elements": elements,
        "groups": [],
        "labels": [],
        "display": {"show_row_clearance_dims": True, "snap_enabled": True},
        "metadata": {
            "adapter": "cnb-eir-v1-to-cabinet-layout-generator-poc.v1",
            "source_eir": "examples/plc-panel/project.json",
            "source_units": "mm",
            "unsupported": unsupported,
            "rail_representation": "locked visual rect proxy; OSS has no DIN rail entity",
        },
    }
    return {"model": model, "library": library}, {
        "source_project": eir.get("id"),
        "devices": len(eir.get("devices", [])),
        "rails": len(eir.get("rails", [])),
        "ducts": len(eir.get("ducts", [])),
        "connections": len(eir.get("connections", [])),
        "unsupported": unsupported,
    }


def run_export(payload: dict[str, Any], export_dir: Path) -> dict[str, Any]:
    import ezdxf
    from ezdxf.addons.drawing import Frontend, RenderContext, layout as dlayout
    from ezdxf.addons.drawing import svg as ezsvg

    # Import the OSS service's real exporter rather than reimplementing DXF.
    import dxf_build

    export_dir.mkdir(parents=True, exist_ok=True)
    document = dxf_build.assemble(payload["model"], payload["library"], scale=1.0)
    dxf_path = export_dir / "cnb-plc-panel.dxf"
    svg_path = export_dir / "cnb-plc-panel.svg"
    audit_path = export_dir / "cnb-plc-panel.audit.json"
    document.saveas(dxf_path)
    auditor = document.audit()
    backend = ezsvg.SVGBackend()
    Frontend(RenderContext(document), backend).draw_layout(document.modelspace())
    page = dlayout.Page(0, 0, dlayout.Units.mm, margins=dlayout.Margins.all(0))
    svg_path.write_text(backend.get_string(page), encoding="utf-8")
    audit = {
        "valid": not auditor.errors,
        "errors": [str(error) for error in auditor.errors],
        "entity_count": len(document.modelspace()),
        "dxf_version": document.dxfversion,
        "layers": sorted({entity.dxf.layer for entity in document.modelspace()}),
        "artifacts": {"dxf": str(dxf_path), "svg": str(svg_path)},
    }
    audit_path.write_text(json.dumps(audit, indent=2, sort_keys=True), encoding="utf-8")
    return audit


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=REPO_ROOT / "examples/plc-panel/project.json")
    parser.add_argument("--output", type=Path, default=REPO_ROOT / "evidence/r4-3/poc1-cabinet-layout-model.json")
    parser.add_argument("--export-dir", type=Path, default=REPO_ROOT / "evidence/r4-3/poc1-cabinet-layout")
    args = parser.parse_args()
    eir = json.loads(args.input.read_text(encoding="utf-8"))
    payload, summary = project_to_oss(eir)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    audit = run_export(payload, args.export_dir)
    result = {"adapter": summary, "export": audit, "model": str(args.output)}
    (args.export_dir / "result.json").write_text(json.dumps(result, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if audit["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
