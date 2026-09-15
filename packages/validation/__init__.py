"""Headless deterministic validation rules for EIR projects."""

from .engine import ValidationIssue, ValidationReport, validate_project

__all__ = ["ValidationIssue", "ValidationReport", "validate_project"]

