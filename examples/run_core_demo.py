"""Generate reproducible EIR, layout, schematic, SVG, and DXF evidence.

Usage from the repository root::

    python examples/run_core_demo.py

The script is intentionally headless so it can run overnight and in CI.  It
does not mutate or import the legacy ``cnberp`` repository.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Dict, Iterable, List, Mapping

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from packages.ai_intent import ComponentIntent, DesignIntent, MockIntentProvider, build_project_from_intent
from packages.cad_export import audit_dxf, audit_with_ezdxf, write_project_artifacts
from packages.component_library import seed_catalog
from packages.layout_engine import LayoutConfig, heuristic_layout, solver_layout
from packages.schematic_adapter import project_to_schematic
from packages.validation import validate_project


def _intent(name: str, components: List[ComponentIntent], width: float, height: float, depth: float = 300) -> DesignIntent:
    return DesignIntent(
        project_name=name,
        enclosure_width_mm=width,
        enclosure_height_mm=height,
        enclosure_depth_mm=depth,
        reserve_percent=20,
        components=components,
        preferences={"terminal_position": "bottom", "source": "core_demo"},
    )


def scenarios() -> Mapping[str, DesignIntent]:
    return {
        "starter-panel": _intent(
            "Starter panel",
            [
                ComponentIntent(part_id="MCCB_MAIN_250A", quantity=1, tag_prefix="QF", function="power", group="main"),
                ComponentIntent(part_id="MCB_3P_16A", quantity=2, tag_prefix="QF-M", function="motor", group="feeders"),
                ComponentIntent(part_id="CONTACTOR_15KW", quantity=2, tag_prefix="KM", function="motor", group="feeders"),
                ComponentIntent(part_id="OVERLOAD_15KW", quantity=2, tag_prefix="FR", function="motor", group="feeders"),
                ComponentIntent(part_id="TERMINAL_4MM", quantity=8, tag_prefix="X", function="terminal", group="terminals"),
            ],
            600,
            1000,
        ),
        "mcc-6-motor": MockIntentProvider().parse("MCC 800x2000x300 mm, 6 motors 15kW, 20% reserve"),
        "plc-panel": MockIntentProvider().parse("PLC control cabinet 600x1200x300 mm with 20% spare"),
    }


def run_scenario(name: str, intent: DesignIntent, root: Path, catalog) -> Dict[str, object]:
    project = build_project_from_intent(intent, catalog)
    heuristic = heuristic_layout(project, catalog)
    solved = solver_layout(project, catalog, LayoutConfig(solver_time_limit_s=3))
    report = validate_project(solved.project)
    schematic = project_to_schematic(solved.project)
    scenario_json = root / "examples" / name / "project.json"
    scenario_json.parent.mkdir(parents=True, exist_ok=True)
    scenario_json.write_text(solved.project.canonical_json(indent=2), encoding="utf-8")
    artifacts = write_project_artifacts(solved.project, root / "evidence" / "generated-dxf" / name, stem=name)
    external_audit = audit_with_ezdxf(artifacts["dxf"])
    # Keep copies in the canonical evidence buckets for simple review tooling.
    json_path = root / "evidence" / "generated-json" / f"{name}.json"
    svg_path = root / "evidence" / "generated-svg" / f"{name}.svg"
    json_path.parent.mkdir(parents=True, exist_ok=True)
    svg_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(solved.project.canonical_json(indent=2), encoding="utf-8")
    svg_path.write_text(artifacts["svg"].read_text(encoding="utf-8"), encoding="utf-8")
    schematic_dir = root / "evidence" / "schematic"
    schematic_dir.mkdir(parents=True, exist_ok=True)
    schematic.save(schematic_dir / f"{name}.json")
    return {
        "name": name,
        "input_components": len(project.devices),
        "heuristic": {"engine": heuristic.engine, "metrics": heuristic.metrics, "valid": validate_project(heuristic.project).valid},
        "solver": {"engine": solved.engine, "metrics": solved.metrics, "warnings": solved.warnings, "valid": report.valid},
        "validation": report.to_dict(),
        "dxf_audit": {"internal": audit_dxf(artifacts["dxf"]).to_dict(), "ezdxf": external_audit},
        "schematic_nodes": len(schematic.nodes),
        "schematic_edges": len(schematic.edges),
        "artifacts": {key: str(value.relative_to(root)) for key, value in artifacts.items()},
    }


def benchmark(root: Path, catalog) -> List[Dict[str, object]]:
    rows: List[Dict[str, object]] = []
    for motor_count in (2, 10, 32):
        intent = MockIntentProvider(catalog).parse(f"MCC 1000x2400x400 mm, {motor_count} motors 15kW")
        project = build_project_from_intent(intent, catalog)
        timings: Dict[str, float] = {}
        started = time.perf_counter()
        heuristic = heuristic_layout(project, catalog)
        timings["heuristic_ms"] = round((time.perf_counter() - started) * 1000, 3)
        started = time.perf_counter()
        solved = solver_layout(project, catalog, LayoutConfig(solver_time_limit_s=1))
        timings["solver_ms"] = round((time.perf_counter() - started) * 1000, 3)
        report = validate_project(solved.project)
        rows.append({"requested_motors": motor_count, "component_count": len(project.devices), "timings": timings, "solver_engine": solved.engine, "valid": report.valid, "error_count": len(report.errors), "overlap_pairs": solved.metrics.get("overlap_pairs", -1)})
    path = root / "evidence" / "test-logs" / "layout_benchmark.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows, indent=2, sort_keys=True), encoding="utf-8")
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", choices=sorted(scenarios()), action="append", help="run only a named scenario")
    parser.add_argument("--output", type=Path, default=ROOT, help="repository root for evidence output")
    args = parser.parse_args()
    root = args.output.resolve()
    catalog = seed_catalog()
    selected = scenarios()
    if args.only:
        selected = {key: selected[key] for key in args.only}
    summaries = [run_scenario(name, intent, root, catalog) for name, intent in selected.items()]
    benches = benchmark(root, catalog)
    log = {"scenarios": summaries, "benchmark": benches}
    log_path = root / "evidence" / "test-logs" / "core_demo.json"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text(json.dumps(log, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps(log, indent=2, sort_keys=True))
    return 0 if all(item["validation"]["valid"] for item in summaries) else 2


if __name__ == "__main__":
    raise SystemExit(main())
