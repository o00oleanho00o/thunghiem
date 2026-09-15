"""Independent third-party DXF read/audit/render evidence.

The exporter has its own lightweight parser. This script intentionally uses
the separately installed ezdxf package so a broken writer/parser pair cannot
declare its own output healthy.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import ezdxf
from ezdxf import bbox


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: audit_with_ezdxf.py FILE.dxf [PNG]", file=sys.stderr)
        return 2
    source = Path(sys.argv[1]).resolve()
    png = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else source.with_suffix(".ezdxf.png")
    doc = ezdxf.readfile(source)
    msp = doc.modelspace()
    counts = {}
    for entity in msp:
        kind = entity.dxftype()
        counts[kind] = counts.get(kind, 0) + 1
    extents = bbox.extents(msp, fast=True)
    bounds = None if not extents.has_data else {
        "min_x": extents.extmin.x,
        "min_y": extents.extmin.y,
        "max_x": extents.extmax.x,
        "max_y": extents.extmax.y,
    }
    result = {
        "file": str(source),
        "dxf_version": doc.dxfversion,
        "entity_count": len(msp),
        "entity_types": counts,
        "bounds": bounds,
        "audit": "ezdxf.readfile + modelspace iteration succeeded",
    }
    png.parent.mkdir(parents=True, exist_ok=True)
    try:
        from ezdxf.addons.drawing import Frontend, RenderContext
        from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
        import matplotlib.pyplot as plt

        fig = plt.figure(figsize=(8, 12), dpi=150)
        ax = fig.add_axes((0, 0, 1, 1))
        backend = MatplotlibBackend(ax)
        Frontend(RenderContext(doc), backend).draw_layout(msp, finalize=True)
        ax.set_aspect("equal")
        fig.savefig(png, bbox_inches="tight")
        plt.close(fig)
        result["render"] = str(png)
    except Exception as exc:
        result["render_error"] = f"{type(exc).__name__}: {exc}"
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
