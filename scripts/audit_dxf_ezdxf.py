"""Independent DXF audit using ezdxf (kept separate from the JS exporter)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import ezdxf


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: .venv/Scripts/python scripts/audit_dxf_ezdxf.py <file.dxf>", file=sys.stderr)
        return 2
    path = Path(sys.argv[1]).resolve()
    if not path.exists():
        print(f"DXF not found: {path}", file=sys.stderr)
        return 2
    try:
        document = ezdxf.readfile(path)
        modelspace = document.modelspace()
        counts: dict[str, int] = {}
        layers: set[str] = set()
        coordinates: list[tuple[float, float]] = []
        for entity in modelspace:
            counts[entity.dxftype()] = counts.get(entity.dxftype(), 0) + 1
            layers.add(entity.dxf.layer)
            if entity.dxftype() == "LINE":
                coordinates.extend([(entity.dxf.start.x, entity.dxf.start.y), (entity.dxf.end.x, entity.dxf.end.y)])
            elif entity.dxftype() == "TEXT":
                coordinates.append((entity.dxf.insert.x, entity.dxf.insert.y))
            elif entity.dxftype() == "CIRCLE":
                coordinates.append((entity.dxf.center.x, entity.dxf.center.y))
        audit = {
            "valid": True,
            "file": str(path),
            "version": document.dxfversion,
            "entityCount": len(modelspace),
            "counts": counts,
            "layers": sorted(layers),
            "bounds": {
                "minX": min((point[0] for point in coordinates), default=None),
                "minY": min((point[1] for point in coordinates), default=None),
                "maxX": max((point[0] for point in coordinates), default=None),
                "maxY": max((point[1] for point in coordinates), default=None),
            },
        }
    except Exception as error:  # pragma: no cover - reports external parser failures
        audit = {"valid": False, "file": str(path), "error": str(error)}
    print(json.dumps(audit, indent=2))
    return 0 if audit["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
