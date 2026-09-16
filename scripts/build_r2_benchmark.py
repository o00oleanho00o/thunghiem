"""Build the frozen R2 reference cabinet benchmark from the local DXF catalog.

The source tree is read-only.  Every selected CAD asset is referenced by its
catalog ``source_asset_id`` and retains an explicit ``source-unverified``
verification level.  No vendor MPN or physical dimension is inferred as fact.
"""
from __future__ import annotations

import csv
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from packages.cad_export import audit_with_ezdxf, write_project_artifacts
from packages.domain_model import Connection, Device, Enclosure, Footprint, PartDefinition, Placement, Project, Terminal, stable_id
from packages.layout_engine import LayoutConfig, heuristic_layout, solver_layout
from packages.validation import validate_project


OUT = ROOT / "benchmarks" / "r2-real-cabinet"
MANIFEST = ROOT / "catalog" / "generated" / "catalog-assets.json"


def choose_records(records: list[dict]) -> list[dict]:
    """Choose representative source files using filename evidence only."""
    wanted = [
        "s7-1200-plc-1211c", "s7-1200-pm1207", "s7-1200-sm-1221",
        "s7-1500-cpu-1511", "s7-1500-sm531", "et200sp-1515sp-pc-cpu-64-bit-hmi-128pt-front",
        "sirius-contactor-cad", "sitop-psu-cad", "sinamics-g120c-vfd-cad",
        "simatic-hmi-ktp700", "s7-300-plc-314", "s7-400-plc-412",
        "et200s-2ai", "s7-1200-cm-1241", "simatic-top-connect-terminal",
    ]
    selected: list[dict] = []
    for token in wanted:
        hit = next((r for r in records if token in r.get("relative_path", "").lower() and r.get("parse_status") == "parsed"), None)
        if hit and hit not in selected:
            selected.append(hit)
    if len(selected) < 15:
        for record in records:
            if record.get("manufacturer") == "Siemens" and record not in selected and record.get("parse_status") == "parsed":
                selected.append(record)
            if len(selected) == 15:
                break
    return selected[:15]


def source_dimensions(record: dict) -> tuple[float, float]:
    bbox = record.get("source_bbox") or record.get("bbox") or {}
    width = float(bbox.get("width") or 40)
    height = float(bbox.get("height") or 40)
    # Keep the reference panel solvable while preserving the source aspect
    # ratio.  This is a benchmark envelope, never a vendor-footprint claim.
    scale = min(1.0, 180.0 / max(width, height))
    return max(8.0, round(width * scale, 3)), max(8.0, round(height * scale, 3))


def build_project(selected: list[dict]) -> Project:
    parts: list[PartDefinition] = []
    devices: list[Device] = []
    for index, record in enumerate(selected, 1):
        asset_id = record["source_asset_id"]
        width, height = source_dimensions(record)
        part_id = f"cadpart-{asset_id}"
        family = record.get("product_family") or "unknown"
        parts.append(PartDefinition(
            id=part_id,
            manufacturer=record.get("manufacturer") or "unknown",
            manufacturer_part="UNRESOLVED",
            description=record.get("candidate_description") or record["relative_path"],
            category=family.lower().replace(" ", "_"),
            footprint=Footprint(width=width, height=height, depth=60, mounting="din_rail", rail_width=35),
            terminals=[Terminal(id="1", name="source terminal")],
            footprint_ref=f"cadasset:{asset_id}",
            cad_asset_id=asset_id,
            aliases=[record["relative_path"]],
        ))
        devices.append(Device(
            id=stable_id("device", "r2", index, asset_id),
            tag=f"-A{index:02d}",
            part_id=part_id,
            function=family,
            description=record.get("candidate_description"),
            terminal_ids=["1"],
            properties={"source_asset_id": asset_id, "verification_level": "source-unverified", "source_units": str(record.get("source_units") or "undeclared")},
        ))
    connections = [Connection(id=stable_id("connection", devices[i].id, devices[i + 1].id), from_device=devices[i].id, from_terminal="1", to_device=devices[i + 1].id, to_terminal="1") for i in range(len(devices) - 1)]
    return Project(id="r2-reference-cabinet", name="R2 Reference Cabinet Benchmark", enclosure=Enclosure(width=1200, height=1600, depth=300, plate_margin=50, reserve_percent=20), parts=parts, devices=devices, connections=connections, metadata={"benchmark_status": "REFERENCE / SEMI-REAL — NOT A HUMAN PRODUCTION CABINET", "source_policy": "DXF source is restricted to catalog/", "cad_verification": "source-unverified; dimensions are normalized source envelopes", "selected_asset_count": len(selected)})


def write_csv(path: Path, rows: list[dict], fields: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader(); writer.writerows(rows)


def scale_benchmark(project: Project) -> list[dict]:
    """Measure deterministic layout at 10/30/100 components and lock replay."""
    rows: list[dict] = []
    for count in (10, 30, 100):
        devices = []
        for index in range(count):
            template = project.devices[index % len(project.devices)]
            devices.append(template.copy(update={"id": stable_id("device", "r2-scale", count, index), "tag": f"-T{index + 1:03d}"}))
        scaled = project.copy(deep=True); scaled.devices = devices; scaled.connections = []
        row = {"component_count": count}
        started = time.perf_counter()
        try:
            h = heuristic_layout(scaled); row.update({"heuristic_ms": round((time.perf_counter() - started) * 1000, 3), "heuristic_valid": validate_project(h.project).valid, "heuristic_engine": h.engine, "heuristic_error": ""})
        except Exception as exc:
            row.update({"heuristic_ms": round((time.perf_counter() - started) * 1000, 3), "heuristic_valid": False, "heuristic_engine": "error", "heuristic_error": f"{exc.__class__.__name__}: {exc}"})
        started = time.perf_counter()
        try:
            s = solver_layout(scaled, config=LayoutConfig(solver_time_limit_s=1)); row.update({"solver_ms": round((time.perf_counter() - started) * 1000, 3), "solver_valid": validate_project(s.project).valid, "solver_engine": s.engine, "solver_error": "; ".join(s.warnings)})
        except Exception as exc:
            row.update({"solver_ms": round((time.perf_counter() - started) * 1000, 3), "solver_valid": False, "solver_engine": "error", "solver_error": f"{exc.__class__.__name__}: {exc}"})
        rows.append(row)
    # Engineer lock must survive regeneration exactly.
    locked_project = project.copy(deep=True)
    baseline = heuristic_layout(locked_project).project
    first = baseline.placements[0].copy(update={"locked": True, "x": baseline.placements[0].x + 5, "y": baseline.placements[0].y + 5})
    locked_project.placements = [first, *[p for p in baseline.placements[1:]]]
    replay = heuristic_layout(locked_project).project.placement_index().get(first.device_id)
    rows.append({"component_count": len(project.devices), "locked_regeneration": bool(replay and replay.x == first.x and replay.y == first.y), "locked_device_id": first.device_id})
    return rows


def main() -> int:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    selected = choose_records(manifest["records"])
    OUT.mkdir(parents=True, exist_ok=True); (OUT / "reference").mkdir(exist_ok=True)
    source_rows = [{k: record.get(k) for k in ("source_asset_id", "relative_path", "source_group", "content_sha256", "dxf_version", "source_units", "source_bbox", "preview_ref", "product_family", "candidate_view", "parse_status")} for record in selected]
    (OUT / "source-manifest.json").write_text(json.dumps({"source_root": "catalog", "asset_count": len(selected), "records": source_rows}, indent=2, sort_keys=True), encoding="utf-8")
    bom = [{"line": i, "source_asset_id": r["source_asset_id"], "description": r.get("candidate_description") or r["relative_path"], "manufacturer": r.get("manufacturer") or "unknown", "quantity": 1, "resolution_status": "resolved-family" if r.get("product_family") else "needs-review", "verification_level": "source-unverified"} for i, r in enumerate(selected, 1)]
    write_csv(OUT / "bom.csv", bom, list(bom[0]))
    (OUT / "expected-devices.json").write_text(json.dumps({"expected_device_count": len(selected), "expected_source_asset_ids": [r["source_asset_id"] for r in selected]}, indent=2), encoding="utf-8")
    resolution = [{"source_asset_id": r["source_asset_id"], "relative_path": r["relative_path"], "product_family": r.get("product_family"), "resolution_status": "resolved-family" if r.get("product_family") else "needs-review", "candidate_view": r.get("candidate_view") or "unknown", "physical_dimensions_status": "unverified-source-envelope", "notes": "Filename/catalog evidence only; no Siemens MPN inferred"} for r in selected]
    write_csv(OUT / "product-resolution.csv", resolution, list(resolution[0]))
    project = build_project(selected)
    started = time.perf_counter(); heuristic = heuristic_layout(project); heuristic_ms = (time.perf_counter() - started) * 1000
    started = time.perf_counter(); solved = solver_layout(project, config=LayoutConfig(solver_time_limit_s=3)); solver_ms = (time.perf_counter() - started) * 1000
    report = validate_project(solved.project)
    artifacts = write_project_artifacts(solved.project, OUT / "artifacts", stem="r2-reference-cabinet")
    (OUT / "benchmark.json").write_text(json.dumps({"benchmark_id": "r2-reference-cabinet", "status": "REFERENCE / SEMI-REAL BENCHMARK — NOT A HUMAN PRODUCTION CABINET", "source_policy": "Only catalog/ DXF assets are valid sources", "components": len(project.devices), "heuristic": {"engine": heuristic.engine, "elapsed_ms": round(heuristic_ms, 3), "metrics": heuristic.metrics, "valid": validate_project(heuristic.project).valid}, "solver": {"engine": solved.engine, "elapsed_ms": round(solver_ms, 3), "metrics": solved.metrics, "warnings": solved.warnings, "valid": report.valid}, "scale_benchmark": scale_benchmark(project), "validation": report.to_dict(), "ezdxf": audit_with_ezdxf(artifacts["dxf"]), "artifacts": {k: str(v.relative_to(ROOT)) for k, v in artifacts.items()}, "selected_asset_ids": [r["source_asset_id"] for r in selected]}, indent=2, sort_keys=True), encoding="utf-8")
    (OUT / "reference" / "README.md").write_text("# R2 reference benchmark\n\nThis is a deterministic semi-real benchmark assembled only from `catalog/` DXF evidence. It is not a human production cabinet and contains no externally verified Siemens footprints. Every CAD reference retains its source asset ID and SHA256 in `source-manifest.json`.\n", encoding="utf-8")
    print(json.dumps({"selected": len(selected), "heuristic_valid": validate_project(heuristic.project).valid, "solver_engine": solved.engine, "solver_valid": report.valid, "dxf": str(artifacts["dxf"])}, indent=2))
    return 0 if report.valid else 2


if __name__ == "__main__":
    raise SystemExit(main())
