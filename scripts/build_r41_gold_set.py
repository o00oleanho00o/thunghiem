"""Build a small, evidence-limited device-object gold set from catalog DXFs.

The source files are never changed. Each profile records the crop used to
remove sheet/title-block noise and keeps the original asset id/hash.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import ezdxf


PROFILES = [
    {
        "gold_id": "gold-hmi-ktp700",
        "asset_id": "source-d2e35ab9238f5738",
        "display_name": "SIMATIC HMI KTP700 Basic DP",
        "manufacturer": "Siemens",
        "candidate_name": "6AV2123-2GA03-0AX0 (source text)",
        "crop": [32.0, 40.0, 108.0, 260.0],
        "view_status": "unknown-overview",
        "mounting_type": "panel-mount-candidate",
        "notes": "Crop removes A3 sheet border; source text contains the candidate order code. View is not explicit.",
    },
    {
        "gold_id": "gold-sinamics-g120c",
        "asset_id": "source-a0a9f79675c3f78e",
        "display_name": "SINAMICS G120C drive",
        "manufacturer": "Siemens",
        "candidate_name": "SINAMICS G120C (candidate)",
        "crop": [55.0, 100.0, 375.0, 220.0],
        "view_status": "front-candidate-low-confidence",
        "mounting_type": "panel-mount-candidate",
        "notes": "Lower device-view region selected from a multi-view source; title block excluded, product order code unresolved.",
    },
    {
        "gold_id": "gold-sinamics-v20",
        "asset_id": "source-a65546c5c7347b1c",
        "display_name": "SINAMICS V20 drive",
        "manufacturer": "Siemens",
        "candidate_name": "SINAMICS V20 (candidate)",
        "crop": [44.0, 188.0, 308.0, 252.0],
        "view_status": "front-candidate-low-confidence",
        "mounting_type": "panel-mount-candidate",
        "notes": "Device-view region selected from an ISO A3 source; annotation/title block excluded, physical product mapping unresolved.",
    },
    {
        "gold_id": "gold-top-connect",
        "asset_id": "source-cd095c0d1e21645e",
        "display_name": "SIMATIC Top Connect terminal accessory",
        "manufacturer": "Siemens",
        "candidate_name": "SIMATIC Top Connect (candidate)",
        "crop": [36.0, 313.0, 88.0, 393.0],
        "view_status": "unknown",
        "mounting_type": "unknown",
        "notes": "Small device region selected from an A3 sheet; accessory identity and mounting method require review.",
    },
]


def xy(value):
    return float(value[0]), float(value[1])


def collect(entity, out, depth=0):
    if depth > 3:
        return
    kind = entity.dxftype()
    if kind == "LINE":
        out.append({"type": "line", "x1": float(entity.dxf.start.x), "y1": float(entity.dxf.start.y), "x2": float(entity.dxf.end.x), "y2": float(entity.dxf.end.y)})
    elif kind in ("LWPOLYLINE", "POLYLINE"):
        try:
            points = list(entity.get_points("xy")) if kind == "LWPOLYLINE" else [(v.dxf.location.x, v.dxf.location.y) for v in entity.vertices]
            for a, b in zip(points, points[1:]):
                out.append({"type": "line", "x1": float(a[0]), "y1": float(a[1]), "x2": float(b[0]), "y2": float(b[1])})
            if getattr(entity, "closed", False) and len(points) > 2:
                out.append({"type": "line", "x1": float(points[-1][0]), "y1": float(points[-1][1]), "x2": float(points[0][0]), "y2": float(points[0][1])})
        except Exception:
            return
    elif kind in ("ARC", "CIRCLE"):
        center = entity.dxf.center
        item = {"type": kind.lower(), "cx": float(center.x), "cy": float(center.y), "r": float(entity.dxf.radius)}
        if kind == "ARC":
            item.update({"start": float(entity.dxf.start_angle), "end": float(entity.dxf.end_angle)})
        out.append(item)
    elif kind == "INSERT":
        try:
            for child in entity.virtual_entities():
                collect(child, out, depth + 1)
        except Exception:
            return


def geometry_points(item):
    if item["type"] == "line":
        return [(item["x1"], item["y1"]), (item["x2"], item["y2"])]
    return [(item["cx"] - item["r"], item["cy"] - item["r"]), (item["cx"] + item["r"], item["cy"] + item["r"])]


def crop_geometry(geometry, crop):
    left, bottom, right, top = crop
    selected = []
    for item in geometry:
        points = geometry_points(item)
        if all(left - 0.01 <= x <= right + 0.01 and bottom - 0.01 <= y <= top + 0.01 for x, y in points):
            next_item = dict(item)
            for key in ("x1", "x2", "cx"):
                if key in next_item:
                    next_item[key] = round(next_item[key] - left, 6)
            for key in ("y1", "y2", "cy"):
                if key in next_item:
                    next_item[key] = round(next_item[key] - bottom, 6)
            selected.append(next_item)
    if not selected:
        raise RuntimeError(f"crop contains no geometry: {crop}")
    points = [point for item in selected for point in geometry_points(item)]
    min_x = min(point[0] for point in points)
    min_y = min(point[1] for point in points)
    max_x = max(point[0] for point in points)
    max_y = max(point[1] for point in points)
    return selected, {"min_x": min_x, "min_y": min_y, "width": max_x - min_x, "height": max_y - min_y}


def svg_preview(geometry, bounds):
    width = max(bounds["width"], 1.0)
    height = max(bounds["height"], 1.0)
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.4f} {height:.4f}"><g fill="none" stroke="#dbeafe" stroke-width="1" vector-effect="non-scaling-stroke">']
    for item in geometry:
        if item["type"] == "line":
            parts.append(f'<line x1="{item["x1"]:.4f}" y1="{height - item["y1"]:.4f}" x2="{item["x2"]:.4f}" y2="{height - item["y2"]:.4f}"/>')
        elif item["type"] == "circle":
            parts.append(f'<circle cx="{item["cx"]:.4f}" cy="{height - item["cy"]:.4f}" r="{abs(item["r"]):.4f}"/>')
        elif item["type"] == "arc":
            start = item["start"]
            end = item["end"]
            delta = (end - start) % 360
            if delta == 0:
                parts.append(f'<circle cx="{item["cx"]:.4f}" cy="{height - item["cy"]:.4f}" r="{abs(item["r"]):.4f}"/>')
                continue
            import math
            sx = item["cx"] + item["r"] * math.cos(math.radians(start))
            sy = item["cy"] + item["r"] * math.sin(math.radians(start))
            ex = item["cx"] + item["r"] * math.cos(math.radians(end))
            ey = item["cy"] + item["r"] * math.sin(math.radians(end))
            parts.append(f'<path d="M {sx:.4f} {height - sy:.4f} A {abs(item["r"]):.4f} {abs(item["r"]):.4f} 0 {1 if delta > 180 else 0} 0 {ex:.4f} {height - ey:.4f}"/>')
    parts.append("</g></svg>")
    return "".join(parts)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("catalog", type=Path)
    args = parser.parse_args()
    root = args.catalog.resolve()
    manifest = json.loads((root / "generated/catalog-assets.json").read_text(encoding="utf-8"))
    records = {record["source_asset_id"]: record for record in manifest["records"]}
    cache_dir = root / "generated/device-gold-cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    output = []
    for profile in PROFILES:
        record = records[profile["asset_id"]]
        if record.get("unit_confidence") != "confirmed-from-dxf" or record.get("units") != "millimetres":
            raise RuntimeError(f"gold asset is not explicitly millimetres: {profile['asset_id']}")
        source = root / record["relative_path"]
        document = ezdxf.readfile(source)
        geometry = []
        for entity in document.modelspace():
            collect(entity, geometry)
        cropped, bounds = crop_geometry(geometry, profile["crop"])
        cache_name = f"{profile['gold_id']}.json"
        cache = {
            "schema_version": "cad-device-gold.v1",
            "gold_id": profile["gold_id"],
            "source_asset_id": profile["asset_id"],
            "source_sha256": record.get("sha256") or record.get("content_sha256"),
            "source_units": "millimetres",
            "crop_source_bbox": {"min_x": profile["crop"][0], "min_y": profile["crop"][1], "width": profile["crop"][2] - profile["crop"][0], "height": profile["crop"][3] - profile["crop"][1]},
            "bounds": bounds,
            "geometry": cropped,
            "entity_count": len(cropped),
        }
        (cache_dir / cache_name).write_text(json.dumps(cache, separators=(",", ":")), encoding="utf-8")
        preview_name = f"{profile['gold_id']}.svg"
        (cache_dir / preview_name).write_text(svg_preview(cropped, bounds), encoding="utf-8")
        output.append({
            **profile,
            "source_relative_path": record["relative_path"],
            "source_sha256": cache["source_sha256"],
            "source_asset_id": profile["asset_id"],
            "geometry_status": "source_verified_clean_crop",
            "identity_status": "document_verified" if profile["gold_id"] == "gold-hmi-ktp700" else "candidate_needs_review",
            "physical_mapping_status": "source_mm_declared_unmapped",
            "physical_envelope_status": "derived_crop_mm_not_approved",
            "placement_capable": False,
            "source_units": "millimetres",
            "derived_bounds": bounds,
            "entity_count": len(cropped),
            "cache_ref": f"catalog/generated/device-gold-cache/{cache_name}",
            "preview_ref": f"catalog/generated/device-gold-cache/{preview_name}",
        })
    result = {"schema_version": "device-gold-set.v1", "policy": "explicit-mm-and-clean-crop-only", "placement_capable_count": 0, "profiles": output}
    (root / "generated/device-gold-set.json").write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"profiles": len(output), "placement_capable": 0, "cache_entities": sum(item["entity_count"] for item in output)}, indent=2))


if __name__ == "__main__":
    main()
