"""Forensic ingestion for the local DXF catalog.

The source tree is read-only from this command's point of view.  All derived
manifests, previews and duplicate candidates are written below ``generated``.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import ezdxf
from ezdxf import bbox


UNITS = {0: "unitless", 1: "inches", 2: "feet", 3: "miles", 4: "millimetres", 5: "centimetres", 6: "metres", 7: "kilometres", 8: "microinches", 9: "mils", 10: "yards", 11: "angstroms", 12: "nanometres", 13: "microns", 14: "decimetres", 15: "decametres", 16: "hectometres", 17: "gigametres", 18: "astronomical units", 19: "light years", 20: "parsecs", 21: "US survey feet", 22: "US survey inches", 23: "US survey yards", 24: "US survey miles", 25: "US survey fathoms", 26: "US survey chains", 27: "US survey furlongs", 28: "US survey leagues"}
FAMILY_RULES = (("SIMATIC S7-1200", r"s7[- ]?1200"), ("SIMATIC S7-1500", r"s7[- ]?1500"), ("ET200SP", r"et200sp"), ("ET200S", r"et200s"), ("S7-300", r"s7[- ]?300"), ("S7-400", r"s7[- ]?400"), ("SINAMICS", r"sinamics"), ("SIRIUS", r"sirius"), ("SITOP", r"sitop"), ("HMI", r"hmi|ktp700"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sniff_dxf(raw: bytes) -> bool:
    text = raw.decode("utf-8", errors="ignore")
    head = text[:20000].upper()
    return "SECTION" in head and ("HEADER" in head or "ENTITIES" in head or "BLOCKS" in head) and "EOF" in text.upper()


def detect_encoding(raw: bytes) -> str:
    for name in ("ascii", "utf-8", "cp1252"):
        try:
            raw.decode(name)
            return name
        except UnicodeDecodeError:
            continue
    return "binary/unknown"


def source_group(rel: Path) -> str:
    return rel.parts[0] if rel.parts else "unknown"


def classify(rel: Path) -> dict[str, Any]:
    stem = rel.stem.lower()
    normalized_stem = re.sub(r"-dxf$", "", stem)
    view = None
    confidence = 0.0
    if "front-view" in stem:
        view, confidence = "front", 0.99
    elif "side-view" in stem:
        view, confidence = "side", 0.99
    elif "top-view" in stem:
        view, confidence = "top", 0.99
    family = next((label for label, pattern in FAMILY_RULES if re.search(pattern, stem, re.I)), None)
    manufacturer = "Siemens" if "siemens" in stem or "simatic" in stem or "sirius" in stem or "sinamics" in stem or "sitop" in stem else None
    description_stem = re.sub(r"-[0-9a-f]{8,}$", "", re.sub(r"-(front|side|top)-view", "", re.sub(r"^[0-9]+-", "", normalized_stem)))
    description = re.sub(r"[-_]+", " ", description_stem).strip()
    product_key = re.sub(r"-[0-9a-f]{8,}$", "", re.sub(r"-(front|side|top)-view", "", re.sub(r"^[0-9]+-", "", normalized_stem)))
    return {"manufacturer": manufacturer, "product_family": family, "candidate_description": description or None, "candidate_product_key": product_key or None, "candidate_view": view, "view_confidence": confidence, "review_status": "auto-safe" if view else "needs-review"}


def point(value: Any) -> tuple[float, float]:
    return float(value[0]), float(value[1])


def add_segment(segments: list[tuple[float, float, float, float]], a: Any, b: Any) -> None:
    try:
        ax, ay = point(a); bx, by = point(b)
        if all(math.isfinite(v) for v in (ax, ay, bx, by)):
            segments.append((ax, ay, bx, by))
    except Exception:
        return


def entity_segments(entity: Any, segments: list[tuple[float, float, float, float]], depth: int = 0) -> None:
    if depth > 3:
        return
    kind = entity.dxftype()
    if kind == "LINE":
        add_segment(segments, entity.dxf.start, entity.dxf.end)
    elif kind in {"LWPOLYLINE", "POLYLINE"}:
        try:
            points = list(entity.get_points("xy")) if kind == "LWPOLYLINE" else [(v.dxf.location.x, v.dxf.location.y) for v in entity.vertices]
            for a, b in zip(points, points[1:]): add_segment(segments, a, b)
            if getattr(entity, "closed", False) and len(points) > 2: add_segment(segments, points[-1], points[0])
        except Exception:
            pass
    elif kind in {"CIRCLE", "ARC"}:
        try:
            center = entity.dxf.center; radius = float(entity.dxf.radius)
            start = math.radians(float(getattr(entity.dxf, "start_angle", 0)))
            end = math.radians(float(getattr(entity.dxf, "end_angle", 360)))
            if kind == "CIRCLE": end = start + 2 * math.pi
            samples = max(12, min(48, int(abs(end - start) * radius / 5) + 1))
            prev = (center.x + radius * math.cos(start), center.y + radius * math.sin(start))
            for i in range(1, samples + 1):
                angle = start + (end - start) * i / samples
                cur = (center.x + radius * math.cos(angle), center.y + radius * math.sin(angle)); add_segment(segments, prev, cur); prev = cur
        except Exception:
            pass
    elif kind == "INSERT":
        try:
            for child in entity.virtual_entities(): entity_segments(child, segments, depth + 1)
        except Exception:
            pass


def svg_preview(doc: Any, path: Path, target: Path, width: float, height: float) -> tuple[int, str]:
    segments: list[tuple[float, float, float, float]] = []
    for entity in doc.modelspace(): entity_segments(entity, segments)
    if not segments:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#0b1422"/><text x="16" y="94" fill="#f4b740" font-family="sans-serif" font-size="14">No renderable modelspace geometry</text></svg>', encoding="utf-8")
        return 0, ""
    xs = [v for segment in segments for v in (segment[0], segment[2])]; ys = [v for segment in segments for v in (segment[1], segment[3])]
    min_x, max_x, min_y, max_y = min(xs), max(xs), min(ys), max(ys)
    pad = max((max_x - min_x), (max_y - min_y), 1) * 0.04
    min_x -= pad; min_y -= pad; width = max_x - min_x + pad; height = max_y - min_y + pad
    render_segments = segments if len(segments) <= 5000 else segments[::math.ceil(len(segments) / 5000)]
    lines = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{min_x:.4f} {-max_y - pad:.4f} {width:.4f} {height:.4f}" preserveAspectRatio="xMidYMid meet">', '<rect width="100%" height="100%" fill="#0b1422"/>']
    for ax, ay, bx, by in render_segments:
        lines.append(f'<line x1="{ax:.4f}" y1="{-ay:.4f}" x2="{bx:.4f}" y2="{-by:.4f}" stroke="#8fc7ff" stroke-width="{max((max_x-min_x)/900, 0.2):.4f}" vector-effect="non-scaling-stroke"/>')
    lines.append("</svg>")
    target.parent.mkdir(parents=True, exist_ok=True); target.write_text("\n".join(lines), encoding="utf-8")
    return len(segments), f"{min_x:.4f},{min_y:.4f},{max_x:.4f},{max_y:.4f}"


def geometry_fingerprint(doc: Any) -> tuple[str, dict[str, Any]]:
    segments: list[tuple[float, float, float, float]] = []
    for entity in doc.modelspace(): entity_segments(entity, segments)
    if not segments: return "empty", {"segments": 0}
    min_x = min(min(s[0], s[2]) for s in segments); min_y = min(min(s[1], s[3]) for s in segments)
    normalized = []
    for ax, ay, bx, by in segments:
        a = (round(ax - min_x, 2), round(ay - min_y, 2)); b = (round(bx - min_x, 2), round(by - min_y, 2)); normalized.append(tuple(sorted((a, b))))
    normalized.sort()
    max_x = max(max(s[0], s[2]) for s in segments); max_y = max(max(s[1], s[3]) for s in segments)
    payload = {"bbox": [round(max_x - min_x, 2), round(max_y - min_y, 2)], "segments": normalized}
    return hashlib.sha256(json.dumps(payload, separators=(",", ":")).encode()).hexdigest(), {"segments": len(segments), "bbox": payload["bbox"]}


def audit(root: Path) -> dict[str, Any]:
    out = root / "generated"; preview_root = out / "previews"; out.mkdir(parents=True, exist_ok=True)
    files = sorted(p for p in root.rglob("*") if p.is_file() and "generated" not in p.parts and p.name != ".gitignore")
    records: list[dict[str, Any]] = []; exact: defaultdict[str, list[str]] = defaultdict(list); fingerprints: defaultdict[str, list[str]] = defaultdict(list)
    for path in files:
        rel = path.relative_to(root); raw = path.read_bytes(); digest = sha256(path); record: dict[str, Any] = {"id": digest[:16], "relative_path": rel.as_posix(), "source_group": source_group(rel), "file_size": len(raw), "sha256": digest, "extension": path.suffix.lower(), "content_is_dxf": sniff_dxf(raw), "parse_status": "failed", "encoding": detect_encoding(raw), **classify(rel)}
        exact[digest].append(rel.as_posix())
        try:
            if not record["content_is_dxf"]: raise ValueError("content sniff did not find a DXF section/EOF")
            doc = ezdxf.readfile(path)
            ext = bbox.extents(doc.modelspace(), fast=False)
            min_x, min_y, _ = ext.extmin; max_x, max_y, _ = ext.extmax
            entities = Counter(entity.dxftype() for entity in doc.modelspace()); layers = sorted({entity.dxf.layer for entity in doc.modelspace() if hasattr(entity.dxf, "layer")}); blocks = sorted(doc.blocks.block_names())
            units_code = doc.header.get("$INSUNITS"); units = UNITS.get(units_code, None)
            fp, fpmeta = geometry_fingerprint(doc); fingerprints[fp].append(rel.as_posix())
            preview = preview_root / f"{digest[:16]}.svg"; segment_count, preview_bounds = svg_preview(doc, path, preview, max_x - min_x, max_y - min_y)
            annotation_present = any(k in entities for k in ("TEXT", "MTEXT", "DIMENSION", "LEADER", "MLEADER"))
            dimensions = sorted((max_x - min_x, max_y - min_y))
            drawing_sheet = annotation_present and any(all(abs(dimensions[i] - sorted(pair)[i]) < 1.0 for i in (0, 1)) for pair in ((420, 297), (279.4, 431.8)))
            has_physical_units = units == "millimetres"
            initial_review = "needs-unit-review" if not has_physical_units else ("needs-product-review" if annotation_present else ("needs-view-review" if not record.get("candidate_view") else "needs-product-review"))
            source_bbox = {"min_x": min_x, "min_y": min_y, "max_x": max_x, "max_y": max_y, "width": max_x - min_x, "height": max_y - min_y}
            record.update({"parse_status": "parsed", "dxf_version": doc.dxfversion, "source_units_code": units_code, "source_units": units, "units_code": units_code, "units": units, "unit_confidence": "confirmed-from-dxf" if has_physical_units else "unknown", "unit_source": "$INSUNITS" if has_physical_units else None, "physical_width_mm": source_bbox["width"] if has_physical_units else None, "physical_height_mm": source_bbox["height"] if has_physical_units else None, "physical_depth_mm": None, "layers": layers, "layer_count": len(layers), "blocks": blocks, "block_count": len(blocks), "entity_types": dict(sorted(entities.items())), "entity_count": sum(entities.values()), "modelspace_entity_count": len(doc.modelspace()), "paperspace_layouts": sorted(name for name in doc.layouts.names() if name.lower() != "model"), "source_bbox": source_bbox, "bbox": source_bbox, "extreme_dimensions": bool(max(max_x - min_x, max_y - min_y) > 5000 or min(max_x - min_x, max_y - min_y) <= 0), "geometry_fingerprint": fp, "geometry_fingerprint_meta": fpmeta, "preview_ref": f"previews/{preview.name}", "preview_viewbox": preview_bounds, "source_to_preview_transform": {"translate_x": -min_x, "translate_y": max_y, "scale": 1.0} if preview_bounds else None, "physical_transform": {"source_units": units, "scale_to_mm": 1.0} if has_physical_units else None, "preview_segment_count": segment_count, "preview_bounds": preview_bounds, "annotation_present": annotation_present, "drawing_sheet": drawing_sheet, "insert_present": "INSERT" in entities, "review_state": initial_review, "suitable_as_panel_footprint": bool(segment_count and max(max_x-min_x, max_y-min_y) < 5000 and not annotation_present and (max_x-min_x) > 0 and (max_y-min_y) > 0)})
            if record["candidate_view"] is None and record["suitable_as_panel_footprint"]: record["review_status"] = "needs-review"
        except Exception as error:
            record["error"] = f"{type(error).__name__}: {error}"
            record["review_status"] = "rejected"
            record["review_state"] = "rejected"
        records.append(record)
    products_by_key: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        geometry_key = record.get("geometry_fingerprint")
        record["geometry_cluster_id"] = "geometry-" + hashlib.sha256((geometry_key or "empty").encode()).hexdigest()[:16]
        key = f"candidate:{record.get('manufacturer')}:{record.get('candidate_product_key')}"
        product_id = "product-" + hashlib.sha256(key.encode()).hexdigest()[:16]
        record["product_id"] = product_id
        record["representation"] = {"asset_id": record["id"], "kind": record.get("candidate_view") or "unknown", "confidence": record.get("view_confidence", 0.0)}
        products_by_key[key].append(record)
    products = [{"id": entries[0]["product_id"], "manufacturer": entries[0].get("manufacturer"), "product_family": entries[0].get("product_family"), "candidate_key": entries[0].get("candidate_product_key"), "identity_status": "candidate-needs-review", "identity_confidence": 0.65, "representations": [entry["representation"] for entry in entries]} for entries in products_by_key.values()]
    duplicate_candidates = []
    for digest, paths in exact.items():
        if len(paths) > 1: duplicate_candidates.append({"kind": "exact-file-duplicate", "confidence": 1.0, "paths": paths, "reason": "identical SHA256"})
    for fp, paths in fingerprints.items():
        if len(paths) > 1: duplicate_candidates.append({"kind": "geometric-near-duplicate", "confidence": 0.92, "paths": paths, "reason": "same translation-normalized line/curve fingerprint"})
    json_path = out / "catalog-assets.json"; json_path.write_text(json.dumps({"schema_version": "cad-asset-catalog.v1", "source_root": "catalog", "asset_count": len(records), "parsed_count": sum(r["parse_status"] == "parsed" for r in records), "product_count": len(products), "products": products, "records": records, "duplicate_candidates": duplicate_candidates}, indent=2), encoding="utf-8")
    fields = ["id", "product_id", "geometry_cluster_id", "relative_path", "source_group", "file_size", "sha256", "encoding", "content_is_dxf", "parse_status", "dxf_version", "source_units", "source_units_code", "physical_width_mm", "physical_height_mm", "unit_confidence", "unit_source", "candidate_product_key", "candidate_view", "product_family", "review_status", "review_state", "entity_count", "layer_count", "block_count", "source_bbox", "preview_ref", "suitable_as_panel_footprint", "error"]
    with (out / "catalog-assets.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields); writer.writeheader()
        for r in records: writer.writerow({key: json.dumps(r.get(key), separators=(",", ":")) if isinstance(r.get(key), (dict, list)) else r.get(key, "") for key in fields})
    report = {"asset_count": len(records), "product_count": len(products), "parsed_count": sum(r["parse_status"] == "parsed" for r in records), "failed_count": sum(r["parse_status"] != "parsed" for r in records), "source_groups": dict(Counter(r["source_group"] for r in records)), "versions": dict(Counter(r.get("dxf_version") for r in records if r.get("dxf_version"))), "units": dict(Counter(r.get("units") or "undeclared" for r in records if r["parse_status"] == "parsed")), "views": dict(Counter(r.get("candidate_view") or "unknown" for r in records)), "review_states": dict(Counter(r.get("review_state") or "unknown" for r in records)), "drawing_sheet_count": sum(bool(r.get("drawing_sheet")) for r in records), "entity_types": dict(sorted(sum((Counter(r.get("entity_types", {})) for r in records), Counter()).items())), "exact_duplicate_groups": sum(1 for item in duplicate_candidates if item["kind"] == "exact-file-duplicate"), "geometric_duplicate_groups": sum(1 for item in duplicate_candidates if item["kind"] == "geometric-near-duplicate"), "suitable_count": sum(bool(r.get("suitable_as_panel_footprint")) for r in records), "products": products, "records": records, "duplicate_candidates": duplicate_candidates}
    (out / "audit-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(); parser.add_argument("root", type=Path); args = parser.parse_args(); report = audit(args.root.resolve()); print(json.dumps({k: report[k] for k in ("asset_count", "parsed_count", "failed_count", "versions", "units", "views", "exact_duplicate_groups", "geometric_duplicate_groups", "suitable_count")}, indent=2))


if __name__ == "__main__": main()
