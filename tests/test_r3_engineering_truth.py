import json
from pathlib import Path

from packages.domain_model import Duct, Footprint, PartDefinition, Placement, Project, Terminal
from packages.validation import validate_project


def _project_with_two_parts():
    part = PartDefinition(
        id="verified-part", manufacturer="Test Vendor", manufacturer_part="TV-1", description="verified part", category="control",
        footprint=Footprint(width=40, height=40, depth=30, mounting="backplate", clearance_mm=10, service_access_direction="right", service_access_depth_mm=30),
        terminals=[Terminal(id="1", name="terminal")],
    )
    other = part.copy(update={"id": "other-part", "manufacturer_part": "TV-2"})
    return Project(
        id="r3-fixture", name="R3 fixture", enclosure={"width": 300, "height": 300, "depth": 200, "plate_margin": 20},
        parts=[part, other], devices=[{"id": "a", "tag": "A", "part_id": "verified-part", "terminal_ids": ["1"]}, {"id": "b", "tag": "B", "part_id": "other-part", "terminal_ids": ["1"]}],
        placements=[{"device_id": "a", "x": 50, "y": 100}, {"device_id": "b", "x": 95, "y": 100}],
    )


def test_e004_clearance_reports_geometric_evidence():
    report = validate_project(_project_with_two_parts())
    issues = [issue for issue in report.errors if issue.code == "E004"]
    assert issues
    assert issues[0].evidence["clearance_mm"] == 10.0


def test_e005_service_access_reports_blocked_corridor():
    project = _project_with_two_parts()
    project.placements = [Placement(device_id="a", x=50, y=100), Placement(device_id="b", x=75, y=100)]
    report = validate_project(project)
    issues = [issue for issue in report.errors if issue.code == "E005"]
    assert issues
    assert issues[0].evidence["other_entity_id"] == "b"


def test_e005_unknown_access_is_warning_not_false_pass():
    project = _project_with_two_parts()
    part = project.parts[0].copy(update={"footprint": project.parts[0].footprint.copy(update={"service_access_direction": None, "service_access_depth_mm": None})})
    project.parts[0] = part
    report = validate_project(project)
    assert any(issue.code == "E005" and issue.severity == "warning" for issue in report.issues)


def test_r3_generated_artifacts_and_evidence_exist():
    root = Path(__file__).parents[1]
    catalog = json.loads((root / "catalog" / "r3" / "products.json").read_text(encoding="utf-8"))
    results = json.loads((root / "benchmarks" / "r3-engineering-truth-cabinet" / "benchmark-results.json").read_text(encoding="utf-8"))
    assert len(catalog["products"]) >= 5
    assert results["final_validation"]["valid"] is True
    assert results["independent_ezdxf_audit"]["valid"] is True
    assert (root / "benchmarks" / "r3-engineering-truth-cabinet" / "exports" / "r3-final.dxf").exists()
