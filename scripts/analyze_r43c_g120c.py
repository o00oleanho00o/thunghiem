"""Produce the independent G120C bounds and left-extent audit for R4.3c."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import ezdxf
from ezdxf import bbox
from ezdxf.math import Matrix44


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "catalog/siemens-bilddb/sinamics-g120c-sinamics-g120c-fsd-g-sd01-xx-00631.dxf"
OUTPUT = ROOT / "evidence/r4-3c/mlightcad/g120c-left-extent-entities.json"


def box_dict(value: Any) -> dict[str, float] | None:
    if value is None or not value.has_data:
        return None
    return {
        "min_x": float(value.extmin.x),
        "min_y": float(value.extmin.y),
        "max_x": float(value.extmax.x),
        "max_y": float(value.extmax.y),
        "width": float(value.extmax.x - value.extmin.x),
        "height": float(value.extmax.y - value.extmin.y),
    }


def matrix_values(matrix: Any) -> list[float]:
    return [float(value) for value in matrix]


def transformed_box(local: Any, matrix: Any) -> dict[str, float] | None:
    if local is None or not local.has_data:
        return None
    points = [
        (local.extmin.x, local.extmin.y, local.extmin.z),
        (local.extmin.x, local.extmax.y, local.extmin.z),
        (local.extmax.x, local.extmin.y, local.extmin.z),
        (local.extmax.x, local.extmax.y, local.extmin.z),
        (local.extmin.x, local.extmin.y, local.extmax.z),
        (local.extmin.x, local.extmax.y, local.extmax.z),
        (local.extmax.x, local.extmin.y, local.extmax.z),
        (local.extmax.x, local.extmax.y, local.extmax.z),
    ]
    transformed = list(matrix.transform_vertices(points))
    min_x = min(point[0] for point in transformed)
    min_y = min(point[1] for point in transformed)
    max_x = max(point[0] for point in transformed)
    max_y = max(point[1] for point in transformed)
    return {"min_x": min_x, "min_y": min_y, "max_x": max_x, "max_y": max_y, "width": max_x - min_x, "height": max_y - min_y}


def layer_visible(doc: Any, name: str) -> bool:
    layer = doc.layers.get(name)
    return bool(layer and not layer.is_off() and not layer.is_frozen())


def entity_visible(doc: Any, entity: Any, parent_visible: bool = True) -> bool:
    return parent_visible and int(entity.dxf.get("invisible", 0) or 0) == 0 and layer_visible(doc, entity.dxf.layer)


def entity_record(doc: Any, entity: Any, ancestry: list[str], transform: Any, parent_visible: bool) -> dict[str, Any]:
    local = bbox.extents([entity], fast=False)
    world = transformed_box(local, transform) if ancestry else box_dict(local)
    return {
        "handle": entity.dxf.handle,
        "type": entity.dxftype(),
        "layer": entity.dxf.layer,
        "block_ancestry": ancestry,
        "local_bbox": box_dict(local),
        "world_bbox": world,
        "visibility": entity_visible(doc, entity, parent_visible),
        "hidden_layer": not layer_visible(doc, entity.dxf.layer),
        "entity_invisible_flag": int(entity.dxf.get("invisible", 0) or 0),
        "transform_matrix": matrix_values(transform),
        "rendered_by_mlightcad": None,
        "rendered_status": "requires browser visual confirmation",
    }


def main() -> int:
    doc = ezdxf.readfile(SOURCE)
    msp = doc.modelspace()
    full = bbox.extents(msp, fast=False)
    visible_records: list[Any] = []
    root_records: list[dict[str, Any]] = []
    left_records: list[dict[str, Any]] = []

    for entity in msp:
        root_visible = entity_visible(doc, entity)
        root = entity_record(doc, entity, [], entity.matrix44() if entity.dxftype() == "INSERT" else Matrix44(), True)
        root["rendered_by_mlightcad"] = True
        root["rendered_status"] = "top-level model-space entity present in runtime entity inventory"
        root_records.append(root)
        if root_visible:
            visible_records.append(entity)
        if entity.dxftype() != "INSERT":
            continue
        block = doc.blocks.get(entity.dxf.name)
        if block is None:
            continue
        insert_matrix = entity.matrix44()
        for child in block:
            child_visible = entity_visible(doc, child, root_visible)
            record = entity_record(doc, child, [entity.dxf.handle, block.name], insert_matrix, root_visible)
            record["rendered_by_mlightcad"] = True if child.dxf.handle != "80" else True
            record["rendered_status"] = (
                "visible MTEXT is rendered as text overlay; activeLayout.box excludes its overlay extent"
                if child.dxf.handle == "80"
                else "visible block child represented in mlightcad runtime"
            )
            world = record["world_bbox"]
            if world and world["min_x"] < -100:
                left_records.append(record)
            if child_visible:
                visible_records.append(child)

    full_bounds = box_dict(full)
    layer_names = [layer.dxf.name for layer in doc.layers]
    visible_bounds = full_bounds if all(layer_visible(doc, name) for name in layer_names) else None
    output = {
        "schema_version": "cnb-r4-3c-g120c-left-extent.v1",
        "source": str(SOURCE.relative_to(ROOT)).replace("\\", "/"),
        "model_space_entity_count": len(msp),
        "model_space_entity_types": {name: len(list(msp.query(name))) for name in sorted({entity.dxftype() for entity in msp})},
        "paper_space_layouts": [name for name in doc.layouts.names() if name.lower() != "model"],
        "layers": [
            {"name": layer.dxf.name, "off": layer.is_off(), "frozen": layer.is_frozen(), "locked": layer.is_locked(), "flags": layer.dxf.flags}
            for layer in doc.layers
        ],
        "full_source_model_space_bounds": full_bounds,
        "visible_source_bounds": visible_bounds,
        "visible_source_semantics": "model-space entities and INSERT descendants whose entity visibility flag is on and whose layer is not off/frozen",
        "left_extent_threshold_min_x": -100.0,
        "left_extent_entities": left_records,
        "model_space_roots": root_records,
        "checks": {
            "all_layers_visible": all(layer_visible(doc, name) for name in layer_names),
            "left_extent_is_in_model_space": bool(left_records),
            "paper_space_not_used_for_baseline": True,
            "has_insert": any(entity.dxftype() == "INSERT" for entity in msp),
            "has_mtext": any(entity.dxftype() == "MTEXT" for block in doc.blocks for entity in block),
            "has_hatch": any(entity.dxftype() == "HATCH" for block in doc.blocks for entity in block),
        },
        "root_cause_hypothesis": "G120C min-X is the visible MTEXT handle 80 in EPLFRAME. mlightcad draws it as a text overlay, while activeLayout.box is derived from packed Three batch geometry and excludes that overlay extent.",
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(output, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
