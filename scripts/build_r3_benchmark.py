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
    SourceArtifact,
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
        clearance_value = fp.get("clearance_mm")
        clearance_provenance = (
            ProvenanceValue(value=clearance_value, status="document_verified", source=item["source_url"], source_artifact_id=item.get("source_artifact_id"), source_locator=item.get("provenance", {}).get("clearance_mm", {}).get("source_locator"), reviewed_at=item.get("retrieved_at"), source_type="vendor_datasheet", confidence="document_verified")
            if clearance_value is not None
            else ProvenanceValue(value=5.0, status="engineering_default", source_artifact_id=None, source_locator="CNB-CLEARANCE-DEFAULT-V1", reviewed_at="2026-09-16", notes="Generic 5 mm design default; not a vendor requirement.", source_type="engineering_default", confidence="engineering_default")
        )
        terminals = [Terminal(id=name, name=name, kind="power" if name in {"L", "N", "PE", "+24V", "0V", "24V"} else "control") for name in item.get("terminals", [])]
        part = PartDefinition(
            id=item["id"],
            manufacturer=item["manufacturer"],
            manufacturer_part=item["manufacturer_order_code"],
            description=item["description"],
            category=item.get("category", "protection"),
            footprint=Footprint(
                width=fp["width_mm"], height=fp["height_mm"], depth=fp["depth_mm"], mounting=fp["mounting"],
                rail_width=fp.get("rail_width_mm"), clearance_mm=clearance_value if clearance_value is not None else 5.0,
                service_access_direction=fp.get("service_access_direction"), service_access_depth_mm=fp.get("service_access_depth_mm"),
                vendor_mounting_position=fp.get("vendor_mounting_position"),
                allowed_rotations=fp.get("allowed_rotations", [0]),
            ),
            terminals=terminals,
            product_identity=ProductIdentity(
                manufacturer=item["manufacturer"], series=item["series"], type_designation=item["type_designation"],
                manufacturer_order_code=item["manufacturer_order_code"], rated_current_a=item.get("rated_current_a"),
                characteristic=item.get("characteristic"),
                description=item["description"], source_url=item["source_url"], source_type=item["source_type"],
                retrieved_at=item["retrieved_at"], verification_status=item["verification_status"],
            ),
            provenance={
                **{
                    key: ProvenanceValue(value=value, status="document_verified", source=item["source_url"], source_artifact_id=item.get("source_artifact_id"), source_locator=item.get("provenance", {}).get(key, {}).get("source_locator"), reviewed_at=item.get("retrieved_at"), source_type="vendor_datasheet", confidence="document_verified")
                    for key, value in {"width_mm": fp["width_mm"], "height_mm": fp["height_mm"], "depth_mm": fp["depth_mm"], "mounting": fp["mounting"]}.items()
                },
                **{key: ProvenanceValue.parse_obj(item["provenance"][key]) for key in ("vendor_mounting_position", "allowed_rotations", "service_access_direction", "service_access_depth_mm", "terminal_identifiers", "terminal_count", "type_designation", "manufacturer_order_code", "rated_current_a", "characteristic")},
                "clearance_mm": clearance_provenance,
            },
            source_artifacts=[SourceArtifact.parse_obj(item["source_artifacts"][0])],
            terminal_model_status=item.get("terminal_model_status", "unknown"),
            symbol_ref=f"r3/symbols/{item['id']}",
        )
        parts.append(part)
    return ComponentCatalog(parts), raw["products"]


def build_project(catalog: ComponentCatalog, products: list[dict]) -> Project:
    enclosure = Enclosure(id="r3-enclosure", width=800, height=1200, depth=300, plate_margin=50, reserve_percent=20)
    devices = []
    quantities = [4, 4, 3, 3, 3, 3, 2, 2]
    group_prefixes = ["QF", "QF", "QF", "QF", "QF", "QF", "QF", "QF"]
    for item, quantity, prefix in zip(products, quantities, group_prefixes):
        for index in range(1, quantity + 1):
            tag = f"{prefix}{len(devices) + 1}"
            devices.append(catalog.instantiate(item["id"], tag, function="protection", instance_key=tag))
    # The source artifact explicitly leaves terminal identifiers unknown. Keep
    # the benchmark physical/topological-neutral instead of fabricating IDs.
    connections = []
    return Project(id="r3-engineering-truth-cabinet", name="R3.1 ABB S200 U engineering-truth cabinet", enclosure=enclosure, parts=catalog.all(), devices=devices, connections=connections, metadata={"benchmark": "R3.1b", "authoritative": True, "release_level": "engineering_layout", "verification_policy": "document_verified reviewed extraction", "cad_policy": "no exact-product CAD available; engineering footprints are engineering envelopes", "manufacturing_ready": False})


def main() -> None:
    catalog, products = load_catalog()
    catalog_products_dir = ROOT / "catalog" / "r3" / "products"
    catalog_products_dir.mkdir(parents=True, exist_ok=True)
    for item in products:
        (catalog_products_dir / f"{item['id']}.json").write_text(json.dumps(item, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    project = build_project(catalog, products)
    heuristic = heuristic_layout(project, catalog, LayoutConfig(solver_time_limit_s=5))
    solver = solver_layout(project, catalog, LayoutConfig(solver_time_limit_s=5))
    # A deterministic manual-review adjustment locks PS1, then regeneration must preserve it.
    adjusted = heuristic.project.copy(deep=True)
    first = adjusted.placements[0]
    adjusted.placements = [p.copy(update={"locked": True}) if p.device_id == first.device_id else p for p in adjusted.placements]
    regenerated = heuristic_layout(adjusted, catalog).project

    if not validate_project(heuristic.project, authoritative=True).valid:
        raise SystemExit(f"heuristic layout invalid: {validate_project(heuristic.project, authoritative=True).to_dict()}")
    if not validate_project(solver.project, authoritative=True).valid:
        raise SystemExit(f"solver layout invalid: {validate_project(solver.project, authoritative=True).to_dict()}")
    if regenerated.placement_index()[first.device_id].x != first.x or not regenerated.placement_index()[first.device_id].locked:
        raise SystemExit("locked placement was not preserved during regeneration")

    OUT.mkdir(parents=True, exist_ok=True)
    for child in (OUT / "exports", OUT / "products", OUT / "provenance"):
        child.mkdir(exist_ok=True)
    bom_rows = []
    quantities = [4, 4, 3, 3, 3, 3, 2, 2]
    for item, quantity in zip(products, quantities):
        bom_rows.append(f"ALL,{item['id']},{item['manufacturer']},{item['type_designation']},{item['manufacturer_order_code']},{quantity}")
    (OUT / "bom.csv").write_text("tag,product_id,manufacturer,type_designation,manufacturer_order_code,quantity\n" + "\n".join(bom_rows) + "\n", encoding="utf-8")
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
    metrics = {"heuristic": {"engine": heuristic.engine, **heuristic.metrics, "validation": validate_project(heuristic.project, authoritative=True).to_dict()}, "solver": {"engine": solver.engine, **solver.metrics, "validation": validate_project(solver.project, authoritative=True).to_dict()}, "manual_corrections": 1, "locked_device": first.device_id, "locked_coordinate_preserved": True, "final_validation": validate_project(regenerated, authoritative=True).to_dict(), "independent_ezdxf_audit": ez_audit}
    (OUT / "benchmark-results.json").write_text(json.dumps(metrics, indent=2, sort_keys=True, default=str) + "\n", encoding="utf-8")
    validation_path = OUT / "validation-report.json"
    validation_path.write_text(json.dumps(metrics["final_validation"], indent=2, sort_keys=True) + "\n", encoding="utf-8")
    (OUT / "audit-manifest.json").write_text(json.dumps({
        "catalog_hash": sha256(CATALOG_PATH),
        "source_artifact_manifest_hash": sha256(ROOT / "catalog" / "r3" / "source-artifacts" / "manifest.json"),
        "canonical_eir_hash": sha256(OUT / "canonical-eir.json"),
        "validation_policy_hash": sha256(ROOT / "catalog" / "r3" / "validation-policy.json"),
        "validation_report_hash": sha256(validation_path),
        "dxf_hash": sha256(OUT / "exports" / "r3-final.dxf"),
        "source_eir_hash": sha256(OUT / "canonical-eir.json"),
        "final_eir_hash": sha256(OUT / "regenerated-layout.json"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"out": str(OUT), "products": len(products), "heuristic": heuristic.engine, "solver": solver.engine, "final_valid": validate_project(regenerated).valid, "ezdxf": ez_audit}, indent=2, default=str))


if __name__ == "__main__":
    main()
