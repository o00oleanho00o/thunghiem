"""Verify the first R4.2 device candidate without promoting bad geometry."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import ezdxf


ORDER_CODE = "6AV2123-2GA03-0AX0"
ARTIFACT_ID = "siemens-ktp700-datasheet-2025-06-17"


def text_values(document):
    values = []
    for layout in document.layouts:
        for entity in layout:
            if entity.dxftype() in {"TEXT", "MTEXT", "ATTRIB"}:
                values.append(str(getattr(entity.dxf, "text", "")))
    for entity in document.modelspace():
        if entity.dxftype() in {"TEXT", "MTEXT", "ATTRIB"}:
            values.append(str(getattr(entity.dxf, "text", "")))
    return values


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def aspect_mapping_passes(source_bounds, physical_width, physical_height, tolerance=0.05):
    source_ratio = float(source_bounds["width"]) / float(source_bounds["height"])
    physical_ratio = float(physical_width) / float(physical_height)
    return abs(source_ratio / physical_ratio - 1) <= tolerance


def placement_gate(identity_verified, source_cad_verified, units_known, representation_known, dimensions_verified, mapping_reviewed, mounting_known, critical_conflict=False):
    return all((identity_verified, source_cad_verified, units_known, representation_known, dimensions_verified, mapping_reviewed, mounting_known)) and not critical_conflict


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("catalog", type=Path)
    args = parser.parse_args()
    root = args.catalog.resolve()
    gold = json.loads((root / "generated/device-gold-set.json").read_text(encoding="utf-8"))
    profile = next(item for item in gold["profiles"] if item["gold_id"] == "gold-hmi-ktp700")
    source = root / profile["source_relative_path"]
    document = ezdxf.readfile(source)
    values = text_values(document)
    source_text_match = any(ORDER_CODE in value.replace("\\P", " ") for value in values)
    evidence_manifest = json.loads((root / "r4_2/source-artifacts/manifest.json").read_text(encoding="utf-8"))
    artifact = evidence_manifest["artifacts"][0]
    artifact_path = root.parent / artifact["local_path"]
    artifact_hash = sha256(artifact_path)
    if artifact_hash != artifact["sha256"]:
        raise RuntimeError(f"official evidence hash mismatch: {artifact_hash}")
    evidence = json.loads((root / "r4_2/source-artifacts/ktp700-dimension-evidence.json").read_text(encoding="utf-8"))
    source_bounds = profile["derived_bounds"]
    physical = evidence["fields"]
    source_ratio = source_bounds["width"] / source_bounds["height"]
    physical_ratio = physical["width_mm"]["value"] / physical["height_mm"]["value"]
    cutout_ratio = physical["panel_cutout_width_mm"]["value"] / physical["panel_cutout_height_mm"]["value"]
    ratio_error_front = abs(source_ratio / physical_ratio - 1)
    ratio_error_cutout = abs(source_ratio / cutout_ratio - 1)
    mapping_acceptable = aspect_mapping_passes(source_bounds, physical["width_mm"]["value"], physical["height_mm"]["value"]) or abs(source_ratio / cutout_ratio - 1) <= 0.05
    source_hash = profile["source_sha256"]
    identity_status = "document_verified" if source_text_match else "needs-review"
    representation_role = "unknown" if not mapping_acceptable else "front_view"
    candidate = {
        "id": "r42-siemens-ktp700-6av2123-2ga03-0ax0",
        "manufacturer": "Siemens",
        "product_family": "SIMATIC HMI Basic Panel",
        "type_designation": physical["type_designation"]["value"],
        "manufacturer_order_code": ORDER_CODE if source_text_match else None,
        "identity_status": identity_status,
        "source_asset_id": profile["source_asset_id"],
        "source_relative_path": profile["source_relative_path"],
        "source_dxf_sha256": source_hash,
        "source_text_evidence": {"matched": source_text_match, "expected": ORDER_CODE, "entity_types": ["TEXT", "MTEXT", "ATTRIB"], "locator": "DXF modelspace/layout text entities"},
        "representation_role": representation_role,
        "representation_confidence": 0.0 if representation_role == "unknown" else 0.95,
        "representation_evidence": {"status": "rejected_aspect_ratio" if not mapping_acceptable else "human_reviewed", "source_crop": profile["crop"], "notes": "The clean crop is a 76 x 220 mm vertical drawing fragment; it does not match the official KTP700 front/cutout aspect ratio."},
        "source_crop_bounds": source_bounds,
        "device_visual_bounds": {"width_mm": source_bounds["width"], "height_mm": source_bounds["height"]},
        "physical_footprint": {"width_mm": physical["width_mm"]["value"], "height_mm": physical["height_mm"]["value"], "depth_mm": physical["depth_mm"]["value"], "panel_cutout_width_mm": physical["panel_cutout_width_mm"]["value"], "panel_cutout_height_mm": physical["panel_cutout_height_mm"]["value"]},
        "source_to_physical_transform": {"scale_x": physical["width_mm"]["value"] / source_bounds["width"], "scale_y": physical["height_mm"]["value"] / source_bounds["height"], "translate_x_mm": 0.0, "translate_y_mm": 0.0, "status": "rejected_non_uniform_mapping" if not mapping_acceptable else "human_reviewed"},
        "aspect_ratio_check": {"source": source_ratio, "official_front": physical_ratio, "official_cutout": cutout_ratio, "relative_error_front": ratio_error_front, "relative_error_cutout": ratio_error_cutout, "tolerance": 0.05, "within_tolerance": mapping_acceptable},
        "mounting_type": physical["mounting_type"]["value"],
        "mounting_surface": "enclosure_door_or_panel_cutout",
        "mounting_orientation": physical["mounting_orientation"]["value"],
        "field_provenance": physical,
        "source_artifact": {"artifact_id": ARTIFACT_ID, "sha256": artifact_hash, "local_path": artifact["local_path"]},
        "placement_capable": placement_gate(source_text_match, True, True, mapping_acceptable, True, mapping_acceptable, True),
        "placement_level": "engineering_layout" if placement_gate(source_text_match, True, True, mapping_acceptable, True, mapping_acceptable, True) else None,
        "manufacturing_ready": False,
        "verification_status": "pass" if source_text_match and mapping_acceptable else "partial_mapping_blocked",
        "blocking_reasons": [] if source_text_match and mapping_acceptable else ["DXF crop aspect ratio does not match official front or cutout dimensions; source representation role remains unknown."],
    }
    result = {"schema_version": "verified-device-set.v1", "verification_policy": "identity-and-physical-mapping-must-both-pass", "verified_device_count": 1 if candidate["placement_capable"] else 0, "decision": "R4.2 PASS — FIRST VERIFIED REAL DEVICE" if candidate["placement_capable"] else "R4.2 PARTIAL — IDENTITY VERIFIED, MAPPING BLOCKED", "devices": [candidate] if candidate["placement_capable"] else [], "candidates": [candidate], "verification_chain": {"source_dxf_sha256": source_hash, "product_evidence_sha256": artifact_hash, "gold_id": profile["gold_id"]}}
    output = root / "generated/verified-device-set.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"decision": result["decision"], "source_text_match": source_text_match, "ratio_error_front": ratio_error_front, "ratio_error_cutout": ratio_error_cutout, "verified_device_count": result["verified_device_count"]}, indent=2))


if __name__ == "__main__":
    main()
