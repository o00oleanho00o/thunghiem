"""Verify the R3.1 catalog/EIR/validation/DXF hash chain."""
from __future__ import annotations
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "benchmarks" / "r3-engineering-truth-cabinet"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    manifest = json.loads((OUT / "audit-manifest.json").read_text(encoding="utf-8"))
    expected = {
        "catalog_hash": digest(ROOT / "catalog/r3/products.json"),
        "source_artifact_manifest_hash": digest(ROOT / "catalog/r3/source-artifacts/manifest.json"),
        "canonical_eir_hash": digest(OUT / "canonical-eir.json"),
        "validation_policy_hash": digest(ROOT / "catalog/r3/validation-policy.json"),
        "validation_report_hash": digest(OUT / "validation-report.json"),
        "dxf_hash": digest(OUT / "exports/r3-final.dxf"),
    }
    mismatches = {key: {"expected": value, "actual": manifest.get(key)} for key, value in expected.items() if manifest.get(key) != value}
    if mismatches:
        print(json.dumps({"valid": False, "mismatches": mismatches}, indent=2))
        raise SystemExit(1)
    print(json.dumps({"valid": True, **expected}, indent=2))


if __name__ == "__main__":
    main()
