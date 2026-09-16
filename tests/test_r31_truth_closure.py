import copy
import hashlib
import json
from pathlib import Path

from packages.domain_model import Footprint, PartDefinition, Project
from packages.validation import validate_project


def _fixture():
    part = PartDefinition(
        id="p", manufacturer="ABB", manufacturer_part="S201U-C6", description="breaker", category="control",
        footprint=Footprint(width=17.5, height=92, depth=71, mounting="din_rail", rail_width=35, clearance_mm=None),
    )
    return Project(id="p", name="fixture", enclosure={"width": 300, "height": 300, "depth": 200}, parts=[part], devices=[{"id": "d", "tag": "QF1", "part_id": "p"}], placements=[{"device_id": "d", "x": 50, "y": 50}])


def test_unknown_clearance_is_not_document_verified():
    project = _fixture()
    assert project.parts[0].footprint.clearance_mm is None
    report = validate_project(project)
    assert any(issue.code == "V004_UNVERIFIED_CLEARANCE" for issue in report.warnings)


def test_authoritative_export_validation_requires_provenance_and_artifact():
    report = validate_project(_fixture(), authoritative=True)
    assert any(issue.code == "E010" for issue in report.errors)


def test_cached_catalog_has_successful_artifact_and_field_locators():
    root = Path(__file__).parents[1]
    catalog = json.loads((root / "catalog/r3/products.json").read_text(encoding="utf-8"))
    artifact = json.loads((root / "catalog/r3/source-artifacts/manifest.json").read_text(encoding="utf-8"))["artifacts"][0]
    assert len(catalog["products"]) >= 5
    assert artifact["retrieval_status"] == "success"
    assert len(artifact["sha256"]) == 64
    for product in catalog["products"]:
        assert product["verification_status"] == "document_verified"
        assert product["provenance"]["width_mm"]["source_artifact_id"] == artifact["id"]
        assert product["provenance"]["width_mm"]["source_locator"]
        assert product["provenance"]["clearance_mm"]["status"] == "unknown"


def test_r31_benchmark_is_dense_and_audited():
    root = Path(__file__).parents[1]
    results = json.loads((root / "benchmarks/r3-engineering-truth-cabinet/benchmark-results.json").read_text(encoding="utf-8"))
    eir = json.loads((root / "benchmarks/r3-engineering-truth-cabinet/regenerated-layout.json").read_text(encoding="utf-8"))
    assert len(eir["devices"]) == 24
    assert len(eir["rails"]) >= 2
    assert len(eir["ducts"]) >= 2
    assert results["final_validation"]["valid"] is True
    assert results["independent_ezdxf_audit"]["valid"] is True


def test_export_chain_manifest_detects_tampered_nested_eir_and_dxf():
    root = Path(__file__).parents[1]
    manifest = json.loads((root / "benchmarks/r3-engineering-truth-cabinet/audit-manifest.json").read_text(encoding="utf-8"))
    eir = json.loads((root / "benchmarks/r3-engineering-truth-cabinet/canonical-eir.json").read_text(encoding="utf-8"))
    eir["parts"][0]["footprint"]["depth"] += 1
    original_eir = (root / "benchmarks/r3-engineering-truth-cabinet/canonical-eir.json").read_bytes()
    assert hashlib.sha256(original_eir).hexdigest() == manifest["canonical_eir_hash"]
    tampered_hash = hashlib.sha256((json.dumps(eir, sort_keys=True, indent=2) + "\n").encode()).hexdigest()
    assert tampered_hash != manifest["canonical_eir_hash"]
    dxf = (root / "benchmarks/r3-engineering-truth-cabinet/exports/r3-final.dxf").read_bytes()
    assert hashlib.sha256(dxf).hexdigest() == manifest["dxf_hash"]
    assert hashlib.sha256(dxf + b"tamper").hexdigest() != manifest["dxf_hash"]
