from __future__ import annotations

import json
import csv
from pathlib import Path

from packages.cad_export import audit_dxf


ROOT = Path(__file__).parents[1]


def test_r2_benchmark_is_catalog_bound_and_round_trips():
    benchmark = json.loads((ROOT / "benchmarks/r2-real-cabinet/benchmark.json").read_text(encoding="utf-8"))
    source = json.loads((ROOT / "benchmarks/r2-real-cabinet/source-manifest.json").read_text(encoding="utf-8"))
    assert benchmark["source_policy"].startswith("Only catalog/")
    assert source["source_root"] == "catalog"
    assert source["asset_count"] == 15
    assert all(item["relative_path"].startswith(("radica-dxf/", "siemens-batch-w33/", "siemens-bilddb/")) for item in source["records"])
    with (ROOT / "benchmarks/r2-real-cabinet/bom.csv").open(newline="", encoding="utf-8") as handle:
        assert all(row["verification_level"] == "source-unverified" for row in csv.DictReader(handle))


def test_r2_generated_dxf_has_independent_audit_and_lock_evidence():
    dxf_path = ROOT / "benchmarks/r2-real-cabinet/artifacts/r2-reference-cabinet.dxf"
    audit = audit_dxf(dxf_path)
    assert audit.valid
    assert audit.entity_count > 100
    benchmark = json.loads((ROOT / "benchmarks/r2-real-cabinet/benchmark.json").read_text(encoding="utf-8"))
    assert benchmark["solver"]["valid"] is True
    assert any(row.get("locked_regeneration") for row in benchmark["scale_benchmark"])
