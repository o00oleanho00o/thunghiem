"""Offline DXF census for the three CNB Siemens assets used in the R4.3 POC.

This exercises the same entity classes that mlightcad's browser data model
loads, while keeping the POC reproducible without downloading a proprietary
DWG converter.  The output is the hand-off manifest for a browser fixture:
source path, units, bounds, entity types/layers and parse timing.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import ezdxf
from ezdxf import bbox


REPO_ROOT = Path(__file__).resolve().parents[2]
ASSETS = {
    "KTP700": REPO_ROOT / "catalog/siemens-bilddb/simatic-hmi-ktp700-basic-dp-7-inch-g-st70-xx-01722.dxf",
    "G120C": REPO_ROOT / "catalog/siemens-bilddb/sinamics-g120c-sinamics-g120c-fsd-g-sd01-xx-00631.dxf",
    "SITOP": REPO_ROOT / "catalog/siemens-bilddb/sitop-sitop-pm1207-ex-24-v-dc-2-5-a-g-kt01-xx-02221.dxf",
}


def census(name: str, path: Path) -> dict[str, object]:
    started = time.perf_counter()
    document = ezdxf.readfile(path)
    modelspace = document.modelspace()
    counts: dict[str, int] = {}
    layers: set[str] = set()
    for entity in modelspace:
        counts[entity.dxftype()] = counts.get(entity.dxftype(), 0) + 1
        layers.add(entity.dxf.layer)
    extents = bbox.extents(modelspace, fast=False)
    return {
        "asset": name,
        "path": str(path),
        "size_bytes": path.stat().st_size,
        "dxf_version": document.dxfversion,
        "units_header": document.header.get("$INSUNITS"),
        "entity_count": len(modelspace),
        "entity_types": dict(sorted(counts.items())),
        "layers": sorted(layers),
        "bounds": {
            "min_x": extents.extmin.x,
            "min_y": extents.extmin.y,
            "max_x": extents.extmax.x,
            "max_y": extents.extmax.y,
            "width": extents.size.x,
            "height": extents.size.y,
        },
        "parse_ms": round((time.perf_counter() - started) * 1000, 3),
        "mlightcad_fixture_status": "source-ready; browser render requires pnpm/node >= 24",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=REPO_ROOT / "evidence/r4-3/poc2-mlightcad-census.json")
    args = parser.parse_args()
    records = []
    for name, path in ASSETS.items():
        if not path.exists():
            raise SystemExit(f"missing DXF asset: {path}")
        records.append(census(name, path))
    payload = {
        "schema_version": "cnb-r4-3-mlightcad-poc.v1",
        "viewer": {
            "repo": "https://github.com/mlightcad/cad-viewer",
            "package": "@mlightcad/cad-simple-viewer",
            "dxf_path": "built-in @mlightcad/data-model converter",
            "dwg_path": "optional converter; default libredwg-web portion is GPL-3.0",
        },
        "records": records,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
