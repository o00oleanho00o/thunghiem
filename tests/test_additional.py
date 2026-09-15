from __future__ import annotations

import json
from pathlib import Path

import pytest

from packages.ai_intent import MockIntentProvider, parse_intent_json
from packages.cad_export import audit_dxf, export_dxf
from packages.component_library import seed_catalog
from packages.domain_model import Connection, Enclosure, Placement, Project, from_json, json_schema
from packages.layout_engine import LayoutCapacityError, heuristic_layout
from packages.schematic_adapter import project_to_schematic
from packages.validation import validate_project


def _project():
    catalog = seed_catalog()
    devices = [
        catalog.instantiate("MCB_3P_16A", "QF1", function="motor"),
        catalog.instantiate("CONTACTOR_15KW", "KM1", function="motor"),
    ]
    return Project(
        id="additional",
        name="Additional tests",
        enclosure=Enclosure(width=600, height=1000, depth=300),
        parts=catalog.all(),
        devices=devices,
    ), catalog


def test_json_round_trip_is_byte_stable():
    project, _ = _project()
    restored = from_json(project.canonical_json())
    assert restored.canonical_json() == project.canonical_json()


def test_checked_in_eir_json_schema_validates_payload_and_is_generated_from_model():
    import jsonschema

    schema_path = Path(__file__).parents[1] / "packages" / "domain_model" / "eir.v1.schema.json"
    checked_in = json.loads(schema_path.read_text(encoding="utf-8"))
    assert checked_in == json_schema()
    jsonschema.Draft202012Validator.check_schema(checked_in)
    project, _ = _project()
    payload = json.loads(project.canonical_json())
    jsonschema.Draft202012Validator(checked_in).validate(payload)
    malformed = dict(payload)
    malformed.pop("enclosure")
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(checked_in).validate(malformed)
    wrong_version = dict(payload, schema_version="eir.v999")
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(checked_in).validate(wrong_version)


def test_cross_entity_rules_remain_in_runtime_validation_layer():
    project, catalog = _project()
    duplicate = catalog.instantiate("MCB_3P_16A", "QF1", function="motor", instance_key="duplicate")
    project.devices.append(duplicate)
    # JSON Schema intentionally cannot express uniqueness across an array of
    # objects; the Pydantic/runtime layer and validator own this check.
    assert json.loads(project.canonical_json())
    assert project.devices[0].tag == duplicate.tag
    report = validate_project(project)
    assert any(issue.code == "E007" for issue in report.errors)


def test_duplicate_device_placements_are_rejected_by_eir_model():
    project, catalog = _project()
    placement = Placement(device_id=project.devices[0].id, x=100, y=100)
    with pytest.raises(ValueError, match="duplicate placements"):
        Project(**dict(project.to_dict(), placements=[placement.to_dict(), placement.to_dict()]))


def test_unknown_device_terminal_mapping_is_reported():
    project, catalog = _project()
    project = heuristic_layout(project, catalog).project
    project.devices[0].terminal_ids.append("BOGUS")
    report = validate_project(project)
    assert any(issue.code == "E008" and issue.entity_id == project.devices[0].id for issue in report.errors)


def test_layout_reports_impossible_enclosure_capacity():
    catalog = seed_catalog()
    devices = [catalog.instantiate("MCB_3P_16A", f"QF{i}") for i in range(1, 41)]
    project = Project(
        id="too-small",
        name="Too small",
        enclosure=Enclosure(width=300, height=300, depth=200, plate_margin=25),
        parts=catalog.all(),
        devices=devices,
    )
    with pytest.raises(LayoutCapacityError):
        heuristic_layout(project, catalog)


def test_layout_attaches_every_din_device_to_a_known_rail():
    project, catalog = _project()
    laid_out = heuristic_layout(project, catalog).project
    rails = {rail.id for rail in laid_out.rails}
    assert laid_out.placements
    assert all(item.rail_id in rails for item in laid_out.placements)
    assert validate_project(laid_out).valid


def test_ai_intent_has_no_geometry_and_rejects_malformed_json():
    intent = MockIntentProvider().parse("MCC 800x2000x300 mm, 6 motors 15kW, 20% reserve")
    assert not hasattr(intent, "x")
    assert intent.enclosure_width_mm == 800
    with pytest.raises(Exception):
        parse_intent_json('{"project_name":"missing components"}')


def test_schematic_coordinates_are_not_panel_coordinates():
    project, catalog = _project()
    panel = heuristic_layout(project, catalog).project
    schematic = project_to_schematic(panel)
    assert schematic.nodes
    panel_positions = {(p.x, p.y) for p in panel.placements}
    schematic_positions = {(n.x, n.y) for n in schematic.nodes}
    assert panel_positions != schematic_positions


def test_dxf_audit_rejects_truncated_document():
    project, catalog = _project()
    laid_out = heuristic_layout(project, catalog).project
    dxf = export_dxf(laid_out)
    assert audit_dxf(dxf).valid
    assert not audit_dxf(dxf.rsplit("0\nEOF", 1)[0]).valid


def test_validation_reports_dangling_terminal_reference():
    project, catalog = _project()
    project = heuristic_layout(project, catalog).project
    connection = {
        "id": "bad-wire",
        "from_device": project.devices[0].id,
        "from_terminal": "NO_SUCH_TERMINAL",
        "to_device": project.devices[1].id,
        "to_terminal": project.devices[1].terminal_ids[0],
    }
    project.connections.append(Connection(**connection))
    report = validate_project(project)
    assert any(issue.code == "E008" for issue in report.errors)
