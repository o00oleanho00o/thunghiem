from __future__ import annotations

import json

import pytest

from packages.ai_intent import ComponentIntent, DesignIntent, IntentParseError, MockIntentProvider, build_project_from_intent
from packages.cad_export import audit_dxf, export_dxf, export_svg
from packages.component_library import seed_catalog
from packages.domain_model import Enclosure, Placement, canonical_json, from_json, from_mm, stable_id, to_mm
from packages.layout_engine import LayoutConfig, heuristic_layout, solver_layout
from packages.schematic_adapter import link_device, project_to_schematic
from packages.validation import validate_project


def mcc_project(motors: int = 2):
    provider = MockIntentProvider()
    return build_project_from_intent(provider.parse(f"MCC 800x2000x300 mm, {motors} motors 15kW"), seed_catalog())


def test_stable_id_and_serialization_are_deterministic():
    assert stable_id("device", "QF1", "MCCB_MAIN_250A") == stable_id("device", "QF1", "MCCB_MAIN_250A")
    project = mcc_project(2)
    assert project.canonical_json() == project.canonical_json()
    assert project.canonical_json() == from_json(project.canonical_json()).canonical_json()
    assert json.loads(project.canonical_json())["schema_version"] == "eir.v1"


def test_explicit_unit_conversion_and_invalid_enclosure_are_rejected():
    assert to_mm(1, "in") == pytest.approx(25.4)
    assert from_mm(25.4, "in") == pytest.approx(1)
    with pytest.raises(ValueError):
        to_mm(1, "yards")
    with pytest.raises(ValueError):
        Enclosure(width=80, height=500, depth=200)


def test_catalog_has_footprints_and_stable_instances():
    catalog = seed_catalog()
    one = catalog.instantiate("MCB_3P_16A", "QF1", function="motor")
    two = catalog.instantiate("MCB_3P_16A", "QF1", function="motor")
    assert one.id == two.id
    assert catalog.get("CNB-MCB-3P-16").footprint.width == 54
    assert len(one.terminal_ids) == 6


def test_heuristic_layout_has_no_collisions_for_demo_panel():
    result = heuristic_layout(mcc_project(6), seed_catalog())
    report = validate_project(result.project)
    assert result.engine == "heuristic"
    assert result.metrics["overlap_pairs"] == 0
    assert report.valid, report.to_dict()


def test_solver_layout_is_explicit_about_fallback_or_solver():
    result = solver_layout(mcc_project(2), seed_catalog(), LayoutConfig(solver_time_limit_s=1))
    assert result.engine.startswith(("ortools-cp-sat-", "solver-fallback-heuristic", "solver-"))
    assert validate_project(result.project).valid
    if result.engine == "solver-fallback-heuristic":
        assert any("OR-Tools unavailable" in warning for warning in result.warnings)


def test_validation_detects_outside_and_overlap():
    project = heuristic_layout(mcc_project(2), seed_catalog()).project
    first, second = project.devices[:2]
    placements = project.placement_index()
    bad = placements[first.id].copy(update={"x": 0, "y": 0})
    bad2 = placements[second.id].copy(update={"x": 0, "y": 0})
    project.placements = [bad if item.device_id == first.id else bad2 if item.device_id == second.id else item for item in project.placements]
    report = validate_project(project)
    assert any(issue.code == "E001" for issue in report.errors)
    assert any(issue.code == "E002" for issue in report.errors)


def test_dxf_round_trip_audit_is_valid_and_deterministic():
    project = heuristic_layout(mcc_project(2), seed_catalog()).project
    first = export_dxf(project)
    second = export_dxf(project)
    assert first == second
    audit = audit_dxf(first)
    assert audit.valid, audit.to_dict()
    assert audit.entity_types["LINE"] > 0
    assert audit.entity_types["TEXT"] > 0
    assert "<svg" in export_svg(project)


def test_schematic_topology_links_back_to_physical_device():
    project = heuristic_layout(mcc_project(2), seed_catalog()).project
    document = project_to_schematic(project)
    assert len(document.nodes) == len(project.devices)
    source = project.devices[0]
    node = link_device(document, source.id)
    assert node is not None
    assert node.device_id == source.id
    assert all(edge.connection_id for edge in document.edges)


def test_intent_schema_rejects_unknown_part_reference():
    intent = DesignIntent(
        project_name="bad",
        enclosure_width_mm=600,
        enclosure_height_mm=1000,
        enclosure_depth_mm=300,
        components=[ComponentIntent(part_id="DOES_NOT_EXIST", quantity=1, tag_prefix="X")],
    )
    with pytest.raises(IntentParseError):
        build_project_from_intent(intent, seed_catalog())
