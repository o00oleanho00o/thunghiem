import copy
import hashlib
import json
import shutil
from pathlib import Path

from packages.domain_model import Footprint, PartDefinition, Project
from packages.validation import validate_project
from packages.layout_engine import heuristic_layout
from scripts.build_r3_benchmark import build_project, load_catalog
from scripts.verify_export_chain import verify_chain


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


def test_abb_type_and_order_code_are_distinct():
    root = Path(__file__).parents[1]
    products = {p["type_designation"]: p for p in json.loads((root / "catalog/r3/products.json").read_text(encoding="utf-8"))["products"]}
    expected = {"S201U-C6": "2CDS271417R0064", "S201U-C16": "2CDS271417R0164", "S201U-C63": "2CDS271417R0634"}
    for designation, order_code in expected.items():
        product = products[designation]
        assert product["type_designation"] != product["manufacturer_order_code"]
        assert product["manufacturer_order_code"] == order_code
        assert product["provenance"]["type_designation"]["source_locator"]
        assert product["provenance"]["manufacturer_order_code"]["source_locator"]


def test_unknown_value_cannot_be_document_verified():
    root = Path(__file__).parents[1]
    products = json.loads((root / "catalog/r3/products.json").read_text(encoding="utf-8"))["products"]
    unknown_fields = ("service_access_direction", "service_access_depth_mm", "terminal_identifiers", "terminal_count", "clearance_mm")
    for product in products:
        for field in unknown_fields:
            assert product["provenance"][field]["value"] is None
            assert product["provenance"][field]["status"] == "unknown"


def test_any_mounting_is_not_same_as_rotation_zero():
    root = Path(__file__).parents[1]
    product = json.loads((root / "catalog/r3/products/abb-s201u-c16.json").read_text(encoding="utf-8"))
    assert product["footprint"]["vendor_mounting_position"] == "any"
    assert product["provenance"]["vendor_mounting_position"]["status"] == "document_verified"
    assert product["provenance"]["allowed_rotations"]["status"] == "engineering_default"


def test_source_pdf_hash_is_verified():
    assert verify_chain()["source_artifacts"]["source-abb-2cdc002168d0202-r1"] == "e3bd374e5540f76034b0168fdf45742ba88dce7e579e522b01449311de54a7e1"


def _copy_chain_fixture(tmp_path: Path):
    root = Path(__file__).parents[1]
    fixture_root = tmp_path / "repo"
    shutil.copytree(root / "catalog", fixture_root / "catalog")
    shutil.copytree(root / "benchmarks/r3-engineering-truth-cabinet", fixture_root / "benchmarks/r3-engineering-truth-cabinet")
    return fixture_root, fixture_root / "benchmarks/r3-engineering-truth-cabinet"


def test_source_pdf_tamper_fails_chain(tmp_path):
    root, out = _copy_chain_fixture(tmp_path)
    pdf = root / "catalog/r3/abb-s200-datasheet.pdf"
    pdf.write_bytes(pdf.read_bytes() + b"tamper")
    try:
        verify_chain(root, out)
    except ValueError as error:
        assert "hash mismatch" in str(error)
    else:
        raise AssertionError("tampered source PDF unexpectedly verified")


def test_missing_source_artifact_fails_chain(tmp_path):
    root, out = _copy_chain_fixture(tmp_path)
    (root / "catalog/r3/abb-s200-datasheet.pdf").unlink()
    try:
        verify_chain(root, out)
    except ValueError as error:
        assert "missing" in str(error)
    else:
        raise AssertionError("missing source artifact unexpectedly verified")


def test_source_manifest_sha_change_fails_chain(tmp_path):
    root, out = _copy_chain_fixture(tmp_path)
    manifest_path = root / "catalog/r3/source-artifacts/manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["artifacts"][0]["sha256"] = "0" * 64
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    try:
        verify_chain(root, out)
    except ValueError as error:
        assert "hash mismatch" in str(error)
    else:
        raise AssertionError("changed source manifest SHA unexpectedly verified")


def test_unknown_terminal_model_produces_warning():
    catalog, products = load_catalog()
    report = validate_project(heuristic_layout(build_project(catalog, products), catalog).project, authoritative=True)
    assert any(issue.code == "V008_UNVERIFIED_TERMINAL_MODEL" for issue in report.warnings)


def test_unknown_service_access_produces_warning():
    catalog, products = load_catalog()
    report = validate_project(heuristic_layout(build_project(catalog, products), catalog).project, authoritative=True)
    assert any(issue.code == "V005_UNVERIFIED_SERVICE_ACCESS" for issue in report.warnings)


def test_engineering_layout_can_pass_with_explicit_warnings():
    catalog, products = load_catalog()
    report = validate_project(heuristic_layout(build_project(catalog, products), catalog).project, authoritative=True, release_level="engineering_layout")
    assert report.valid
    assert report.warnings


def test_manufacturing_release_rejects_unknown_terminal_or_access_data():
    catalog, products = load_catalog()
    report = validate_project(heuristic_layout(build_project(catalog, products), catalog).project, authoritative=True, release_level="manufacturing_ready")
    assert not report.valid
    assert any(issue.code == "M001_UNVERIFIED_TERMINAL_MODEL" for issue in report.errors)
    assert any(issue.code == "M002_UNVERIFIED_SERVICE_ACCESS" for issue in report.errors)


def test_no_stale_phoenix_metadata_in_r31_benchmark():
    root = Path(__file__).parents[1]
    benchmark = root / "benchmarks/r3-engineering-truth-cabinet"
    text = "\n".join(path.read_text(encoding="utf-8", errors="ignore") for path in benchmark.rglob("*.json"))
    assert "Phoenix Contact" not in text
    assert "R3 Phoenix" not in text
    assert "review_verified only" not in text


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
