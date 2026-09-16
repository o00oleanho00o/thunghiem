"""Prompt-to-structured-design spike with a deterministic mock provider."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Dict, Iterable, List, Mapping, Optional, Protocol, Sequence, Tuple

try:
    from pydantic.v1 import BaseModel, Field, validator
except ImportError:  # pragma: no cover
    from pydantic import BaseModel, Field, validator

from packages.component_library import ComponentCatalog, seed_catalog
from packages.domain_model import Connection, Device, Enclosure, PartDefinition, Project, stable_id


class IntentParseError(ValueError):
    pass


class ComponentIntent(BaseModel):
    part_id: str
    quantity: int = Field(gt=0, le=1000)
    tag_prefix: str
    function: str = "general"
    group: Optional[str] = None
    properties: Dict[str, str] = Field(default_factory=dict)

    class Config:
        extra = "forbid"

    @validator("part_id", "tag_prefix", "function")
    def nonempty(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("intent fields must not be empty")
        return value


class DesignIntent(BaseModel):
    schema_version: str = "design-intent.v1"
    project_name: str
    enclosure_width_mm: float = Field(gt=0)
    enclosure_height_mm: float = Field(gt=0)
    enclosure_depth_mm: float = Field(gt=0)
    reserve_percent: float = Field(default=20.0, ge=0, lt=100)
    components: List[ComponentIntent] = Field(min_items=1)
    preferences: Dict[str, str] = Field(default_factory=dict)
    source_prompt: Optional[str] = None

    class Config:
        extra = "forbid"

    @validator("project_name")
    def name_nonempty(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("project_name must not be empty")
        return value

    def to_dict(self) -> Dict[str, object]:
        if hasattr(self, "model_dump"):
            return self.model_dump(exclude_none=True)  # type: ignore[attr-defined]
        return self.dict(exclude_none=True)


class IntentProvider(Protocol):
    def parse(self, prompt: str) -> DesignIntent:
        ...


def parse_intent_json(payload: str | Mapping[str, object]) -> DesignIntent:
    raw = json.loads(payload) if isinstance(payload, str) else payload
    try:
        if hasattr(DesignIntent, "model_validate"):
            return DesignIntent.model_validate(raw)  # type: ignore[attr-defined]
        return DesignIntent.parse_obj(raw)
    except Exception as exc:
        raise IntentParseError(f"invalid structured design intent: {exc}") from exc


class MockIntentProvider:
    """Deterministic stand-in for an LLM provider.

    It intentionally returns structured intent only.  No geometry or DXF is
    generated here, making the AI boundary easy to replace with a real model.
    """

    def __init__(self, catalog: Optional[ComponentCatalog] = None) -> None:
        self.catalog = catalog or seed_catalog()

    def parse(self, prompt: str) -> DesignIntent:
        if not prompt or not prompt.strip():
            raise IntentParseError("prompt is empty")
        text = " ".join(prompt.strip().split())
        dimensions = re.search(r"(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*[x×]\s*(\d+(?:\.\d+)?))?\s*mm?", text, re.I)
        if not dimensions:
            # Vietnamese/English prompts commonly omit the unit.
            dimensions = re.search(r"(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*[x×]\s*(\d+(?:\.\d+)?))?", text, re.I)
        if not dimensions:
            raise IntentParseError("enclosure dimensions are required (for example 800x2000x300 mm)")
        width = float(dimensions.group(1))
        height = float(dimensions.group(2))
        depth = float(dimensions.group(3) or 300)
        lower = text.lower()
        motors_match = re.search(r"(\d+)\s*(?:x\s*)?(?:motor|motors|động cơ)", lower)
        motor_count = int(motors_match.group(1)) if motors_match else 0
        components: List[ComponentIntent] = []
        components.append(ComponentIntent(part_id="MCCB_MAIN_250A", quantity=1, tag_prefix="QF", function="power", group="main"))
        if motor_count:
            components.extend(
                [
                    ComponentIntent(part_id="MCB_3P_16A", quantity=motor_count, tag_prefix="QF-M", function="motor", group="feeders"),
                    ComponentIntent(part_id="CONTACTOR_15KW", quantity=motor_count, tag_prefix="KM", function="motor", group="feeders"),
                    ComponentIntent(part_id="OVERLOAD_15KW", quantity=motor_count, tag_prefix="FR", function="motor", group="feeders"),
                    ComponentIntent(part_id="TERMINAL_4MM", quantity=max(4, motor_count * 3), tag_prefix="X", function="terminal", group="terminals"),
                ]
            )
        if "plc" in lower or "programmable" in lower:
            components.extend(
                [
                    ComponentIntent(part_id="PSU_24V_120W", quantity=1, tag_prefix="G", function="control", group="control"),
                    ComponentIntent(part_id="PLC_CPU", quantity=1, tag_prefix="PLC", function="plc", group="control"),
                    ComponentIntent(part_id="PLC_IO_16", quantity=2, tag_prefix="IO", function="plc", group="control"),
                    ComponentIntent(part_id="RELAY_4CO", quantity=4, tag_prefix="KA", function="control", group="control"),
                ]
            )
        reserve_match = re.search(r"(\d+)\s*%\s*(?:reserve|spare|dự phòng)", lower)
        reserve = float(reserve_match.group(1)) if reserve_match else 20.0
        project_name = "MCC panel" if motor_count else "Electrical control panel"
        return DesignIntent(
            project_name=project_name,
            enclosure_width_mm=width,
            enclosure_height_mm=height,
            enclosure_depth_mm=depth,
            reserve_percent=reserve,
            components=components,
            preferences={"terminal_position": "bottom", "provider": "mock-regex"},
            source_prompt=text,
        )


def build_project_from_intent(intent: DesignIntent, catalog: Optional[ComponentCatalog] = None) -> Project:
    """Resolve structured intent into canonical EIR semantics and topology."""

    catalog = catalog or seed_catalog()
    devices: List[Device] = []
    used_parts: Dict[str, PartDefinition] = {}
    counters: Dict[str, int] = {}
    for spec in intent.components:
        part = catalog.maybe_get(spec.part_id)
        if part is None:
            raise IntentParseError(f"unknown part reference in intent: {spec.part_id}")
        used_parts[part.id] = part
        for _ in range(spec.quantity):
            counters[spec.tag_prefix] = counters.get(spec.tag_prefix, 0) + 1
            suffix = counters[spec.tag_prefix]
            tag = f"{spec.tag_prefix}{suffix}"
            devices.append(
                catalog.instantiate(
                    part.id,
                    tag,
                    function=spec.function,
                    properties=spec.properties,
                    instance_key=f"{intent.project_name}|{tag}",
                )
            )
    # Add deterministic main-to-feeder starter topology where those families
    # exist.  Invalid connectivity is intentionally impossible to hide: all
    # terminal IDs are checked later by the validation layer.
    by_function: Dict[str, List[Device]] = {}
    for device in devices:
        by_function.setdefault(device.function, []).append(device)
    main = next((device for device in devices if device.part_id == "MCCB_MAIN_250A"), None)
    breakers = [device for device in devices if device.part_id == "MCB_3P_16A"]
    contactors = [device for device in devices if device.part_id == "CONTACTOR_15KW"]
    overloads = [device for device in devices if device.part_id == "OVERLOAD_15KW"]
    terminals = [device for device in devices if device.part_id == "TERMINAL_4MM"]
    connections: List[Connection] = []
    for index, breaker in enumerate(breakers):
        if main:
            connections.append(Connection(id=stable_id("conn", main.id, breaker.id, "power"), from_device=main.id, from_terminal="T1", to_device=breaker.id, to_terminal="L1", kind="wire", label=f"FEEDER-{index + 1}"))
        if index < len(contactors):
            contactor = contactors[index]
            connections.append(Connection(id=stable_id("conn", breaker.id, contactor.id, "power"), from_device=breaker.id, from_terminal="T1", to_device=contactor.id, to_terminal="L1", kind="wire"))
        if index < len(overloads):
            overload = overloads[index]
            if index < len(contactors):
                contactor = contactors[index]
                connections.append(Connection(id=stable_id("conn", contactor.id, overload.id, "power"), from_device=contactor.id, from_terminal="T1", to_device=overload.id, to_terminal="L1", kind="wire"))
            if index < len(terminals):
                terminal = terminals[index]
                connections.append(Connection(id=stable_id("conn", overload.id, terminal.id, "load"), from_device=overload.id, from_terminal="T1", to_device=terminal.id, to_terminal="1", kind="wire"))
    return Project(
        schema_version="eir.v1",
        id=stable_id("project", intent.project_name, intent.enclosure_width_mm, intent.enclosure_height_mm),
        name=intent.project_name,
        enclosure=Enclosure(width=intent.enclosure_width_mm, height=intent.enclosure_height_mm, depth=intent.enclosure_depth_mm, reserve_percent=intent.reserve_percent),
        parts=[used_parts[key] for key in sorted(used_parts)],
        devices=devices,
        metadata={"intent_schema": intent.schema_version, "intent_provider": intent.preferences.get("provider", "external"), "source_prompt": intent.source_prompt or ""},
        connections=connections,
    )
