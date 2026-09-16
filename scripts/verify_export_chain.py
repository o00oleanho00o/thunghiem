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


def verify_chain(root: Path = ROOT, out: Path = OUT) -> dict:
    manifest = json.loads((out / "audit-manifest.json").read_text(encoding="utf-8"))
    source_manifest_path = root / "catalog/r3/source-artifacts/manifest.json"
    source_manifest = json.loads(source_manifest_path.read_text(encoding="utf-8"))
    artifact_hashes = {}
    for artifact in source_manifest.get("artifacts", []):
        local_path = root / artifact["local_path"]
        if not local_path.is_file():
            raise ValueError(f"source artifact missing: {artifact['id']} ({local_path})")
        actual = digest(local_path)
        if actual != artifact.get("sha256"):
            raise ValueError(f"source artifact hash mismatch: {artifact['id']}")
        artifact_hashes[artifact["id"]] = actual
    expected = {
        "catalog_hash": digest(root / "catalog/r3/products.json"),
        "source_artifact_manifest_hash": digest(source_manifest_path),
        "canonical_eir_hash": digest(out / "canonical-eir.json"),
        "validation_policy_hash": digest(root / "catalog/r3/validation-policy.json"),
        "validation_report_hash": digest(out / "validation-report.json"),
        "dxf_hash": digest(out / "exports/r3-final.dxf"),
    }
    mismatches = {key: {"expected": value, "actual": manifest.get(key)} for key, value in expected.items() if manifest.get(key) != value}
    if mismatches:
        print(json.dumps({"valid": False, "mismatches": mismatches}, indent=2))
        raise ValueError(json.dumps({"valid": False, "mismatches": mismatches}, indent=2))
    return {"valid": True, **expected, "source_artifacts": artifact_hashes}


def main() -> None:
    try:
        print(json.dumps(verify_chain(), indent=2))
    except (OSError, KeyError, ValueError) as error:
        print(json.dumps({"valid": False, "error": str(error)}, indent=2))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
