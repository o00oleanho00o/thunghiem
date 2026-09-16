from __future__ import annotations

import json
from pathlib import Path

from packages.cad_export import audit_dxf

ROOT = Path(__file__).parents[1]
BASE = ROOT / "benchmarks/r2b-verified-siemens-cabinet"


def test_r2b_keeps_vendor_verification_honest_and_catalog_bound():
    benchmark = json.loads((BASE / "benchmark.json").read_text(encoding="utf-8"))
    source = json.loads((BASE / "source-manifest.json").read_text(encoding="utf-8"))
    assert benchmark["status"].startswith("INCOMPLETE")
    assert benchmark["vendor_verified_dimensions"] == 0
    assert benchmark["verified_siemens_count"] == 0
    assert benchmark["unresolved"] == 8
    assert source["source_root"] == "catalog"
    assert all(item["relative_path"].startswith(("radica-dxf/", "siemens-batch-w33/", "siemens-bilddb/")) for item in source["records"] if "relative_path" in item)


def test_r2b_real_geometry_and_topology_survive_export():
    benchmark = json.loads((BASE / "benchmark.json").read_text(encoding="utf-8"))
    audit = audit_dxf(BASE / "exports/r2b-verified-cabinet.dxf")
    assert audit.valid
    assert audit.entity_types.get("ARC", 0) > 100
    assert audit.entity_types.get("CIRCLE", 0) > 0
    assert benchmark["usable_cad_representations"] == 8
    assert benchmark["topology"]["connections"] >= 6
    assert len(benchmark["topology"]["functional_groups"]) >= 6
    assert benchmark["heuristic"]["metrics"]["overlap_pairs"] == 0
    assert benchmark["lock_regenerate"]["locked_exact"] is True
    cache = json.loads((ROOT / "catalog/generated/vector-cache-manifest.json").read_text(encoding="utf-8"))
    assert len(cache["records"]) >= 8
    assert all(item["status"] == "ok" and item["entity_count"] > 10 for item in cache["records"][:8])
