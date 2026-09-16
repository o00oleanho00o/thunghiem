"""Build the R3.1 catalog from locally cached official ABB documentation."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT = ROOT / "catalog" / "r3" / "abb-s200-datasheet.pdf"
OUT = ROOT / "catalog" / "r3"
RETRIEVED_AT = "2026-09-16T00:00:00Z"
URL = "https://library.e.abb.com/public/b0896d9679854f92bba039c62c596831/2CDC002168D0202.pdf"

PRODUCTS = [
    ("S201U-C6", "6"),
    ("S201U-C10", "10"),
    ("S201U-C16", "16"),
    ("S201U-C20", "20"),
    ("S201U-C25", "25"),
    ("S201U-C32", "32"),
    ("S201U-C40", "40"),
    ("S201U-C63", "63"),
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def field(value, artifact_id: str, locator: str, *, notes: str = ""):
    return {
        "value": value,
        "status": "document_verified",
        "source_artifact_id": artifact_id,
        "source_locator": locator,
        "reviewed_at": RETRIEVED_AT,
        "notes": notes,
        "source_type": "vendor_datasheet",
        "confidence": "document_verified",
    }


def unknown(notes: str):
    return {
        "value": None,
        "status": "unknown",
        "source_artifact_id": None,
        "source_locator": None,
        "reviewed_at": RETRIEVED_AT,
        "notes": notes,
        "source_type": "unknown",
        "confidence": "unknown",
    }


def main() -> None:
    if not ARTIFACT.exists():
        raise SystemExit(f"missing cached source artifact: {ARTIFACT}")
    digest = sha256(ARTIFACT)
    artifact_id = "source-abb-2cdc002168d0202-r1"
    artifact = {
        "id": artifact_id,
        "manufacturer": "ABB",
        "manufacturer_part_number": "S201U-C6..S201U-C63",
        "type": "official_datasheet_pdf",
        "original_url": URL,
        "local_path": "catalog/r3/abb-s200-datasheet.pdf",
        "sha256": digest,
        "retrieved_at": RETRIEVED_AT,
        "retrieval_status": "success",
        "document_revision": "2CDC002168D0202 Rev. F",
        "document_date": None,
    }
    products = []
    for mpn, current in PRODUCTS:
        products.append({
            "id": "abb-" + mpn.lower().replace("-", "-"),
            "manufacturer": "ABB",
            "series": "System pro M compact S 200 U",
            "manufacturer_part_number": mpn,
            "description": f"ABB S 201 U miniature circuit breaker, C characteristic, {current} A",
            "source_url": URL,
            "source_type": "official_datasheet",
            "retrieved_at": RETRIEVED_AT,
            "verification_status": "document_verified",
            "source_artifact_id": artifact_id,
            "source_artifacts": [artifact],
            "footprint": {
                "width_mm": 17.5,
                "height_mm": 92.0,
                "depth_mm": 71.0,
                "mounting": "din_rail",
                "rail_width_mm": 35.0,
                "clearance_mm": None,
                "service_access_direction": None,
                "service_access_depth_mm": None,
                "allowed_rotations": [0],
            },
            "provenance": {
                "width_mm": field(17.5, artifact_id, "PDF page 3, Technical data, Dimensions and weight, pole dimensions H x D x W: 92 x 71 x 17.5 mm"),
                "height_mm": field(92.0, artifact_id, "PDF page 3, Technical data, Dimensions and weight, pole dimensions H x D x W: 92 x 71 x 17.5 mm"),
                "depth_mm": field(71.0, artifact_id, "PDF page 3, Technical data, Dimensions and weight, pole dimensions H x D x W: 92 x 71 x 17.5 mm"),
                "mounting": field("din_rail", artifact_id, "PDF page 3, Technical data, Installation: DIN rail 35 mm acc. to EN 60715 by fast clip"),
                "rail_width_mm": field(35.0, artifact_id, "PDF page 3, Technical data, Installation: DIN rail 35 mm acc. to EN 60715 by fast clip"),
                "allowed_rotations": field([0], artifact_id, "PDF page 3, Technical data, Mounting position: any", notes="0 is the canonical panel orientation; source permits any mounting position."),
                "clearance_mm": unknown("No product-specific clearance value in cached datasheet; do not use vendor truth."),
                "service_access_direction": unknown("No service-face direction in cached datasheet."),
                "service_access_depth_mm": unknown("No service-access depth in cached datasheet."),
                "terminal_identifiers": unknown("Datasheet documents terminal type and conductor cross-section but does not identify terminal IDs; topology must not fabricate IDs."),
                "terminal_count": unknown("Terminal count is not stated as a canonical ID set in the cached artifact."),
                "order_code": field(mpn, artifact_id, "PDF page 6, Ordering data characteristic C, S 201 U table"),
            },
            "terminals": [],
            "terminal_model_status": "unknown",
            "cad_available": False,
            "cad_verified": False,
            "known_unknowns": ["product-specific clearance", "service access face/depth", "terminal identifiers/count", "exact-product CAD representation"],
        })
    manifest = {"schema_version": "r3.1-source-artifacts.v1", "artifacts": [artifact], "catalog_sha256": None}
    (OUT / "source-artifacts").mkdir(parents=True, exist_ok=True)
    (OUT / "source-artifacts" / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    catalog = {
        "schema_version": "r3.1-product-catalog.v1",
        "verification_policy": "Only locally cached official source artifacts can produce document_verified fields. Unknown fields remain unknown.",
        "products": products,
    }
    target = OUT / "products.json"
    target.write_text(json.dumps(catalog, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    manifest["catalog_sha256"] = sha256(target)
    (OUT / "source-artifacts" / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    for product in products:
        (OUT / "products" / f"{product['id']}.json").write_text(json.dumps(product, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"product_count": len(products), "artifact_count": 1, "artifact_sha256": digest, "catalog_sha256": manifest["catalog_sha256"]}, indent=2))


if __name__ == "__main__":
    main()
