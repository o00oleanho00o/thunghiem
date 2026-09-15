"""Structured AI intent boundary.

Providers propose a validated DesignIntent; deterministic code owns catalog
resolution, topology, layout, validation, and CAD export.
"""

from .intent import (
    ComponentIntent,
    DesignIntent,
    IntentParseError,
    IntentProvider,
    MockIntentProvider,
    build_project_from_intent,
    parse_intent_json,
)

__all__ = [
    "ComponentIntent",
    "DesignIntent",
    "IntentParseError",
    "IntentProvider",
    "MockIntentProvider",
    "build_project_from_intent",
    "parse_intent_json",
]

