import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "catalog"


def test_source_artifact_manifest_hash_matches_bytes():
    manifest = json.loads((CATALOG / "r4_2/source-artifacts/manifest.json").read_text(encoding="utf-8"))
    artifact = manifest["artifacts"][0]
    digest = hashlib.sha256((ROOT / artifact["local_path"]).read_bytes()).hexdigest()
    assert digest == artifact["sha256"]


def test_ktp700_field_provenance_is_individual():
    evidence = json.loads((CATALOG / "r4_2/source-artifacts/ktp700-dimension-evidence.json").read_text(encoding="utf-8"))
    fields = evidence["fields"]
    expected = {"manufacturer_order_code", "width_mm", "height_mm", "depth_mm", "panel_cutout_width_mm", "panel_cutout_height_mm", "mounting_type", "mounting_orientation", "front_view_dimensions"}
    assert expected <= fields.keys()
    assert all(item["source_artifact_id"] and item["source_locator"] for item in fields.values())


def test_source_physical_mapping_failure_is_machine_readable():
    result = json.loads((CATALOG / "generated/verified-device-set.json").read_text(encoding="utf-8"))
    candidate = result["candidates"][0]
    assert candidate["verification_status"] == "partial_mapping_blocked"
    assert candidate["source_to_physical_transform"]["status"] == "rejected_non_uniform_mapping"
    assert candidate["aspect_ratio_check"]["relative_error_front"] > 0.05


def test_hash_chain_contains_dxf_and_product_evidence():
    result = json.loads((CATALOG / "generated/verified-device-set.json").read_text(encoding="utf-8"))
    chain = result["verification_chain"]
    assert len(chain["source_dxf_sha256"]) == 64
    assert len(chain["product_evidence_sha256"]) == 64
