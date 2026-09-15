# AI Strategy

The experimental boundary is:

```text
prompt / BOM / spreadsheet
  -> provider (LLM or deterministic parser)
  -> DesignIntent schema
  -> catalog resolution + topology construction
  -> deterministic rules and layout
  -> renderer/export
```

`packages/ai_intent/intent.py` implements this with `MockIntentProvider`. It
parses a constrained prompt into component quantities, enclosure dimensions,
preferences, and reserve space. `build_project_from_intent` rejects unknown
part IDs before creating an EIR. The provider never emits coordinates, DXF
entities, or unvalidated manufacturer claims.

## Rejection tests

The boundary must reject missing dimensions, empty component lists, unknown
part references, impossible dimensions, and malformed JSON. A real provider
should return JSON constrained by the same schema and include a source span or
confidence for each inferred field. Deterministic validation remains mandatory
after the provider, even when the provider is a trusted internal model.

## What to measure next

- field-level parse accuracy against reviewed BOMs;
- unknown-part and ambiguous-rating rate;
- human correction time versus manual BOM entry;
- invalid-layout rate after catalog resolution;
- repeatability across model/provider versions.

Historical layout learning is a later ranking signal for group/zone preference,
not a replacement for clearance, connectivity, or collision rules.

