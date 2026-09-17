# R4.2 First Verified Real Device

## Decision

**R4.2 PARTIAL - identity verified, physical mapping blocked.**

The official Siemens Industry Mall datasheet was retrieved and hash-cached for
`6AV2123-2GA03-0AX0`. The supplied DXF also contains the exact order code in a
`TEXT` entity. This is sufficient to verify identity, but not sufficient to
promote the supplied drawing crop to an engineering placement footprint.

## Identity

- Manufacturer: Siemens (document verified)
- Product family: SIMATIC HMI Basic Panel
- Type designation: KTP700 Basic color DP (document verified)
- Manufacturer order code: `6AV2123-2GA03-0AX0` (document verified in both
  official PDF and source DXF text)
- Source DXF: `source-d2e35ab9238f5738`, unchanged, SHA256 retained in the
  generated verification set

The parser in `scripts/build_r42_verified_device.py` extracts TEXT/MTEXT/ATTRIB
values and tests the expected code. Identity is therefore evidence-derived,
not selected by `gold_id`.

## CAD and representation

The source is an AC1015 DXF with explicit millimetre units. The R4.1 clean crop
is `76 x 220` source millimetres and contains the tall rectangular drawing
fragment plus connector marks. Review against the official physical dimensions
cannot establish that this is the KTP700 front view, so
`representation_role=unknown` and `representation_confidence=0` remain
explicit. The original DXF and the clean vector cache are both preserved.

## Physical evidence

Official Siemens page 7 values:

- housing front: `214 x 158 mm`
- mounting cutout: `198 x 142 mm`
- mounting depth: `39 mm`
- mounting semantics: panel/door cutout, not DIN rail

These values are stored with field-level provenance in
`catalog/r4_2/source-artifacts/ktp700-dimension-evidence.json`.

## Mapping gate

The explicit transform candidate is:

```text
scale_x = 214 / 76 = 2.8158
scale_y = 158 / 220 = 0.7182
```

The crop aspect ratio is `0.3455`; the official front ratio is `1.3544` and
the cutout ratio is `1.3944`. Relative errors are `74.49%` and `75.22%`, against
the 5% acceptance tolerance. This requires non-uniform scaling and leaves the
represented view unresolved, so the mapping is rejected rather than promoted.

## Placement and export

The R4.2 workbench scenario uses `mounting_surface=enclosure_door_or_panel_cutout`
and never places the HMI on a DIN rail. The machine-readable
`catalog/generated/verified-device-set.json` has `verified_device_count=0` and
contains the blocked candidate separately from the R4.1 gold set.

Transient gold/vector geometry still survives SVG and DXF export, and the
exported DXF is reopened with `ezdxf` in the R4.2 export test. Export evidence
does not change the placement gate or make the output manufacturing-ready.

## Reproducibility

```text
python scripts/build_r42_verified_device.py catalog
python -m pytest tests/test_r42_first_verified_device.py tests/test_r42_source_artifacts.py
node scripts/test_r42_ui.cjs
node scripts/test_r42_export.cjs
```

Screenshots under `evidence/r4-2/` show the review card, the vector on the
panel/door review surface, the physical-envelope warning, and inspector
provenance. The next experiment is to obtain a dimensioned Siemens CAD/front
view or a reviewed crop whose aspect ratio matches the official envelope; until
then this dataset does not support a truthful `placement_capable=true` claim.
