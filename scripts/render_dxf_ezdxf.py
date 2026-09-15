"""Render a generated DXF with ezdxf's independent Matplotlib backend."""
from __future__ import annotations

import sys
from pathlib import Path

import ezdxf
from ezdxf.addons.drawing import Frontend, RenderContext, config
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
import matplotlib.pyplot as plt


def main() -> int:
    if len(sys.argv) not in {2, 3}:
        print("Usage: .venv/Scripts/python scripts/render_dxf_ezdxf.py <file.dxf> [output.png]", file=sys.stderr)
        return 2
    input_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else input_path.with_suffix(".ezdxf.png")
    if not input_path.exists():
        print(f"DXF not found: {input_path}", file=sys.stderr)
        return 2
    document = ezdxf.readfile(input_path)
    figure = plt.figure(figsize=(10, 14), dpi=120, facecolor="#101722")
    axes = figure.add_axes([0.02, 0.02, 0.96, 0.96], facecolor="#101722")
    drawing_config = config.Configuration.defaults()
    drawing_config = drawing_config.with_changes(
        custom_bg_color="#101722",
        custom_fg_color="#f8fafc",
        lineweight_scaling=0.5,
    )
    Frontend(RenderContext(document), MatplotlibBackend(axes), drawing_config).draw_layout(document.modelspace(), finalize=True)
    axes.set_aspect("equal")
    axes.axis("off")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    figure.savefig(output_path, dpi=120, facecolor=figure.get_facecolor())
    plt.close(figure)
    print(f"Rendered {input_path} -> {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
