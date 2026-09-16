"""Build the offline R3 engineering-truth mini-cabinet from the review catalog."""

from __future__ import annotations

import csv
import hashlib
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from packages.cad_export import audit_with_ezdxf, write_project_artifacts
from packages.component_library import ComponentCatalog
from packages.domain_model import (
    Connection,
    Enclosure,
    Footprint,
    PartDefinition,
    Placement,
    ProductIdentity,
    Project,
    ProvenanceValue,
    Terminal,
    stable_id,
)
from packages.layout_engine import LayoutConfig, heuristic_layout, solver_layout
from packages.validation import validate_project

CATALOG_PATH = ROOT / "catalog" / "r3" / "products.json"
OUT = ROOT / "benchmarks" / "r3-engineering-truth-cabinet"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_catalog() -> tuple[ComponentCatalog, list[dict]]:
    raw = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    parts = []
    for item in raw["products"]:
        fp = item["footprint"]
        terminals = [Terminal(id=name, name=name, kind="power" if name in {"L", "N", "PE", "+24V", "0V", "24V"} else "control") for name in item["terminals"]]
        part = PartDefinition(
            id=item["id"],
            manufacturer=item["manufacturer"],
            manufacturer_part=item["manufacturer_part_number"],
            description=item["description"],
            category="terminal" if "terminal" in item["description"].lower() else "power_supply" if "power supply" in item["description"].lower() else "control",
            footprint=Footprint(
                width=fp["width_mm"], height=fp["height_mm"], depth=fp["depth_mm"], mounting=fp["mounting"],
                rail_width=fp.get("rail_width_mm"), clearance_mm=fp.get("clearance_mm", 0),
                service_access_direction=fp.get("service_access_direction"), service_access_depth_mm=fp.get("service_access_depth_mm"),
                allowed_rotations=fp.get("allowed_rotations", [0]),
            ),
            terminals=terminals,
            product_identity=ProductIdentity(
                manufacturer=item["manufacturer"], series=item["series"], manufacturer_part_number=item["manufacturer_part_number"],
                description=item["description"], source_url=item["source_url"], source_type=item["source_type"],
                retrieved_at=item["retrieved_at"], verification_status=item["verification_status"],
            ),
            provenance={
                key: ProvenanceValue(value=value, source=item["source_url"], source_type="official_product_page", confidence="review_verified")
                for key, value in {"width_mm": fp["width_mm"], "height_mm": fp["height_mm"], "depth_mm": fp["depth_mm"], "mounting": fp["mounting"], "clearance_mm": fp.get("clearance_mm", 0), "service_access_direction": fp.get("service_access_direction")}.items()
            },
            symbol_ref=f"r3/symbols/{item['id']}",
        )
        parts.append(part)
    return ComponentCatalog(parts), raw["products"]


def build_project(catalog: ComponentCatalog, products: list[dict]) -> Project:
    enclosure = Enclosure(id="r3-enclosure", width=800, height=1200, depth=300, plate_margin=50, reserve_percent=20)
    devices = []
    tags = ["PS1", "PS2", "K1", "K2", "X1", "X2", "SW1", "SPD1"]
    for item, tag in zip(products, tags):
        devices.append(catalog.instantiate(item["id"], tag, function="control", instance_key=tag))
    connections = []
    for left, right in zip(devices, devices[1:]):
        from_terminal = left.terminal_ids[0]
        to_terminal = right.terminal_ids[0]
        connections.append(Connection(id=stable_id("connection", left.id, right.id), from_device=left.id, from_terminal=from_terminal, to_device=right.id, to_terminal=to_terminal, kind="wire"))
    return Project(id="r3-engineering-truth-cabinet", name="R3 Phoenix Contact control cabinet", enclosure=enclosure, parts=catalog.all(), devices=devices, connections=connections, metadata={"benchmark": "R3", "authoritative": True, "verification_policy": "review_verified only", "cad_policy": "no exact-product CAD available; engineering footprints are authoritative envelopes"})


def main() -> None:
    catalog, products = load_catalog()
    project = build_project(catalog, products)
    heuristic = heuristic_layout(project, catalog, LayoutConfig(solver_time_limit_s=5))
    solver = solver_layout(project, catalog, LayoutConfig(solver_time_limit_s=5))
    # A deterministic manual-review adjustment locks PS1, then regeneration must preserve it.
    adjusted = heuristic.project.copy(deep=True)
    first = adjusted.placements[0]
    adjusted.placements = [p.copy(update={"x": p.x - 5, "locked": True}) if p.device_id == first.device_id else p for p in adjusted.placements]
    regenerated = heuristic_layout(adjusted, catalog).project

    if not validate_project(heuristic.project).valid:
        raise SystemExit(f"heuristic layout invalid: {validate_project(heuristic.project).to_dict()}")
    if not validate_project(solver.project).valid:
        raise SystemExit(f"solver layout invalid: {validate_project(solver.project).to_dict()}")
    if regenerated.placement_index()[first.device_id].x != first.x - 5 or not regenerated.placement_index()[first.device_id].locked:
        raise SystemExit("locked placement was not preserved during regeneration")

    OUT.mkdir(parents=True, exist_ok=True)
    for child in (OUT / "exports", OUT / "products", OUT / "provenance"):
        child.mkdir(exist_ok=True)
    (OUT / "bom.csv").write_text("tag,product_id,manufacturer,mpn,quantity\n" + "\n".join(f"{tag},{item['id']},{item['manufacturer']},{item['manufacturer_part_number']},1" for item, tag in zip(products, ["PS1", "PS2", "K1", "K2", "X1", "X2", "SW1", "SPD1"])) + "\n", encoding="utf-8")
    (OUT / "product-resolution.json").write_text(json.dumps(products, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    (OUT / "source-manifest.json").write_text(json.dumps({"catalog_source": str(CATALOG_PATH.relative_to(ROOT)), "catalog_sha256": sha256(CATALOG_PATH), "retrieved_at": datetime.now(timezone.utc).isoformat(), "product_count": len(products), "verification_statuses": {item["verification_status"] for item in products}}, indent=2, sort_keys=True, default=list) + "\n", encoding="utf-8")
    for item in products:
        (OUT / "products" / f"{item['id']}.json").write_text(json.dumps(item, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    (OUT / "canonical-eir.json").write_text(project.canonical_json(indent=2) + "\n", encoding="utf-8")
    (OUT / "heuristic-layout.json").write_text(heuristic.project.canonical_json(indent=2) + "\n", encoding="utf-8")
    (OUT / "solver-layout.json").write_text(solver.project.canonical_json(indent=2) + "\n", encoding="utf-8")
    (OUT / "manual-review-layout.json").write_text(adjusted.canonical_json(indent=2) + "\n", encoding="utf-8")
    (OUT / "regenerated-layout.json").write_text(regenerated.canonical_json(indent=2) + "\n", encoding="utf-8")
    for name, result in (("heuristic", heuristic.project), ("solver", solver.project), ("final", regenerated)):
        write_project_artifacts(result, OUT / "exports", stem=f"r3-{name}")
    final_dxf = OUT / "exports" / "r3-final.dxf"
    ez_audit = audit_with_ezdxf(final_dxf)
    (OUT / "exports" / "r3-final.dxf.ezdxf.json").write_text(json.dumps(ez_audit, indent=2, sort_keys=True, default=str) + "\n", encoding="utf-8")
    metrics = {"heuristic": {"engine": heuristic.engine, **heuristic.metrics, "validation": validate_project(heuristic.project).to_dict()}, "solver": {"engine": solver.engine, **solver.metrics, "validation": validate_project(solver.project).to_dict()}, "manual_corrections": 1, "locked_device": first.device_id, "locked_coordinate_preserved": True, "final_validation": validate_project(regenerated).to_dict(), "independent_ezdxf_audit": ez_audit}
    (OUT / "benchmark-results.json").write_text(json.dumps(metrics, indent=2, sort_keys=True, default=str) + "\n", encoding="utf-8")
    validation_path = OUT / "validation-report.json"
    validation_path.write_text(json.dumps(metrics["final_validation"], indent=2, sort_keys=True) + "\n", encoding="utf-8")
    (OUT / "audit-manifest.json").write_text(json.dumps({"source_eir_hash": sha256(OUT / "canonical-eir.json"), "final_eir_hash": sha256(OUT / "regenerated-layout.json"), "validation_report_hash": sha256(validation_path), "catalog_snapshot_hash": sha256(CATALOG_PATH), "generated_dxf_hash": sha256(OUT / "exports" / "r3-final.dxf"), "generated_at": datetime.now(timezone.utc).isoformat()}, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"out": str(OUT), "products": len(products), "heuristic": heuristic.engine, "solver": solver.engine, "final_valid": validate_project(regenerated).valid, "ezdxf": ez_audit}, indent=2, default=str))


if __name__ == "__main__":
    main()
