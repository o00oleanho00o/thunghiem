import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GOLD = ROOT / "catalog" / "generated" / "device-gold-set.json"
CACHE = ROOT / "catalog" / "generated" / "device-gold-cache"


def test_gold_manifest_is_evidence_limited():
    manifest = json.loads(GOLD.read_text(encoding="utf-8"))
    assert manifest["schema_version"] == "device-gold-set.v1"
    assert len(manifest["profiles"]) == 4
    assert manifest["placement_capable_count"] == 0
    required = {"asset_id", "source_asset_id", "source_relative_path", "source_sha256", "display_name", "manufacturer", "candidate_name", "geometry_status", "identity_status", "physical_mapping_status", "view_status", "mounting_type", "physical_envelope_status", "placement_capable", "cache_ref", "preview_ref"}
    for profile in manifest["profiles"]:
        assert required <= profile.keys()
        assert profile["source_units"] == "millimetres"
        assert profile["placement_capable"] is False
        assert len(profile["source_sha256"]) == 64
        assert (ROOT / profile["cache_ref"]).exists()
        assert (ROOT / profile["preview_ref"]).exists()


def test_gold_cache_is_clean_crop_and_preserves_provenance():
    manifest = json.loads(GOLD.read_text(encoding="utf-8"))
    for profile in manifest["profiles"]:
        cache = json.loads((ROOT / profile["cache_ref"]).read_text(encoding="utf-8"))
        assert cache["source_asset_id"] == profile["source_asset_id"]
        assert cache["source_sha256"] == profile["source_sha256"]
        assert cache["source_units"] == "millimetres"
        assert cache["geometry"]
        crop = cache["crop_source_bbox"]
        bounds = cache["bounds"]
        assert bounds["width"] <= crop["width"] + 1e-6
        assert bounds["height"] <= crop["height"] + 1e-6
        assert bounds["min_x"] == 0
        assert bounds["min_y"] >= 0


def test_no_raw_geometry_in_canonical_eir_schema():
    app = (ROOT / "apps" / "web" / "app.js").read_text(encoding="utf-8")
    assert "goldProfileId" in app
    assert "footprintRef" in app
    assert "component.geometry" not in app
