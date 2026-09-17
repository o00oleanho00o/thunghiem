# R4.1 Device Object Closure

## Outcome

R4.1 closes the semantic gap between a raw DXF preview and a device-like
workbench object for a deliberately small Siemens gold set. Four source DXFs
with an explicit `$INSUNITS=4` declaration are cropped into device-view caches;
the source files, hashes, and relative paths remain unchanged. The web library
can inspect each profile, show its clean vector preview, and drag it onto the
cabinet as a semantic object with a readable name, candidate identity, view,
mounting, and physical-envelope statuses.

This is a **GO for device-object UX**, not a GO for authoritative engineering
placement. `placement_capable_count` is intentionally zero. No profile has an
approved product mapping and no physical envelope was silently promoted from a
crop into a manufacturing footprint.

## Gold set

| Gold asset | Source evidence | Geometry | Identity | View | Mounting | Physical envelope | Placement |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SIMATIC HMI KTP700 Basic DP | source text contains `6AV2123-2GA03-0AX0` | clean crop | document candidate | unknown overview | panel-mount candidate | mm declared, crop not approved | blocked |
| SINAMICS G120C drive | Siemens family/file evidence | clean crop | candidate | front candidate, low confidence | panel-mount candidate | mm declared, crop not approved | blocked |
| SINAMICS V20 drive | Siemens family/file evidence | clean crop | candidate | front candidate, low confidence | panel-mount candidate | mm declared, crop not approved | blocked |
| SIMATIC Top Connect terminal accessory | Siemens family/file evidence | clean crop | candidate | unknown | unknown | mm declared, crop not approved | blocked |

The machine-readable source of truth is
`catalog/generated/device-gold-set.json`; each profile points to a JSON cache
and SVG preview under `catalog/generated/device-gold-cache/`.

## What changed in the workbench

- A dedicated **Gold devices** library tab presents all four previews and their
  statuses before placement.
- Gold drag/drop uses a separate `text/cnb-gold` payload and creates a semantic
  component with `goldId`, `source_asset_id`, `footprintRef`-compatible metadata,
  and no raw DXF entities in canonical model state.
- BOM rows use candidate/display names rather than opaque
  `CANDIDATE-source-*` identifiers.
- Validation reports gold objects as preview-only and excludes them from
  authoritative overlap/clearance claims.
- Auto-layout has a plate-mount fallback that arranges device envelopes when a
  scenario has no DIN rails; dimensions remain in source millimetres.

## Verification evidence

- `py -3.10 -m pytest tests/test_r41_device_object.py` checks four profiles,
  preserved SHA256 provenance, non-empty clean caches, and the canonical
  geometry boundary.
- `node scripts/test_r41_ui.cjs` checks the four-card library, preview/detail
  status, direct gold drop, real SVG image rendering, readable BOM, and
  deterministic auto-layout.
- `node scripts/test_r41_export.cjs` verifies that transient gold-cache geometry
  is present in both SVG and DXF exports; it does not make those exports
  authoritative.
- Existing R4 UI/export tests remain part of the release run.
- Screenshots are stored under `evidence/r4-1-*` and show library, detail,
  placed panel, auto-layout, deep zoom, and pan states.

## Limits and next experiment

The crop windows are evidence-backed extraction regions, not vendor-verified
product envelopes. Several source drawings contain multiple views or sheet
content; the crop removes obvious frame/title-block noise but does not prove
which projection is the authoritative mounting view. The next engineering step
is a human review against vendor dimension drawings for one product at a time;
only then may a profile receive an approved physical footprint and become
placement-capable.
