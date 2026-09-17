import json
from pathlib import Path

import ezdxf

from scripts.build_r42_verified_device import ORDER_CODE, aspect_mapping_passes, placement_gate, text_values


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "catalog"
RESULT = CATALOG / "generated" / "verified-device-set.json"


def load_result():
    return json.loads(RESULT.read_text(encoding="utf-8"))


def test_ktp700_source_contains_expected_order_number():
    manifest = json.loads((CATALOG / "generated/device-gold-set.json").read_text(encoding="utf-8"))
    profile = next(item for item in manifest["profiles"] if item["gold_id"] == "gold-hmi-ktp700")
    document = ezdxf.readfile(CATALOG / profile["source_relative_path"])
    assert any(ORDER_CODE in value for value in text_values(document))


def test_product_identity_not_hardcoded_by_gold_id():
    result = load_result()
    candidate = result["candidates"][0]
    assert candidate["source_text_evidence"]["matched"] is True
    assert candidate["manufacturer_order_code"] == ORDER_CODE
    assert "gold-hmi-ktp700" not in candidate["identity_status"]


def test_verified_dimensions_have_source_locator():
    candidate = load_result()["candidates"][0]
    for field in ("width_mm", "height_mm", "depth_mm", "panel_cutout_width_mm", "panel_cutout_height_mm"):
        provenance = candidate["field_provenance"][field]
        assert provenance["verification_status"] == "document_verified"
        assert provenance["source_artifact_id"]
        assert provenance["source_locator"]


def test_representation_role_has_evidence():
    candidate = load_result()["candidates"][0]
    assert candidate["representation_role"] in {"unknown", "front_view"}
    assert candidate["representation_evidence"]["source_crop"]
    assert candidate["representation_evidence"]["status"]


def test_source_to_physical_transform_is_explicit():
    transform = load_result()["candidates"][0]["source_to_physical_transform"]
    assert transform["scale_x"] > 0 and transform["scale_y"] > 0
    assert transform["status"]


def test_aspect_ratio_mapping_is_not_promoted_when_outside_tolerance():
    candidate = load_result()["candidates"][0]
    check = candidate["aspect_ratio_check"]
    assert check["within_tolerance"] is False
    assert candidate["placement_capable"] is False


def test_preview_device_remains_not_placement_capable():
    gold = json.loads((CATALOG / "generated/device-gold-set.json").read_text(encoding="utf-8"))
    assert gold["placement_capable_count"] == 0
    assert all(profile["placement_capable"] is False for profile in gold["profiles"])


def test_verified_device_set_is_separate_and_hash_chained():
    result = load_result()
    assert result["verified_device_count"] == 0
    assert result["devices"] == []
    chain = result["verification_chain"]
    assert len(chain["source_dxf_sha256"]) == 64
    assert len(chain["product_evidence_sha256"]) == 64


def test_verified_hmi_uses_panel_or_door_mounting_contract():
    candidate = load_result()["candidates"][0]
    assert candidate["mounting_type"] == "panel_mount"
    assert candidate["mounting_surface"] in {"enclosure_door_or_panel_cutout", "panel_cutout"}


def test_partial_decision_is_explicit_and_honest():
    result = load_result()
    assert result["decision"].startswith("R4.2 PARTIAL")
    assert result["candidates"][0]["blocking_reasons"]


def test_verified_device_becomes_placement_capable_when_all_gates_pass():
    bounds = {"width": 214, "height": 158}
    assert aspect_mapping_passes(bounds, 214, 158)
    assert placement_gate(True, True, True, True, True, True, True)


def test_preview_device_blocked_from_engineering_layout_gate():
    assert not placement_gate(True, True, True, True, True, False, True)
    assert not placement_gate(True, True, True, True, True, True, True, critical_conflict=True)
