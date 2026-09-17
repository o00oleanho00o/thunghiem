# R4.3 Evidence

Evaluation date: 2026-09-17. Commands below were run from the CNB repository
root. Generated files are deterministic hand-off artifacts; the EIR remains the
source of truth.

## POC 1 - CNB EIR to Cabinet Layout Generator

Command:

```text
python experiments/oss/cabinet_layout_adapter.py
```

Input: `examples/plc-panel/project.json`.

Result: PASS for the adapter/export path. The projection contains 9 devices, 2
DIN rails, and 3 ducts. The OSS exporter generated a valid AC1032 DXF with 29
entities on `DUCT`, `EQUIP`, `PLATE`, and `TEXT` layers, plus an SVG rendering.
Rails are locked visual rectangle proxies because the OSS model has no first-class
rail collection. The source example has no connections; if connections are present
the adapter records them as unsupported metadata rather than dropping them from
EIR silently.

Artifacts:

- [projected OSS model](poc1-cabinet-layout-model.json)
- [DXF export](poc1-cabinet-layout/cnb-plc-panel.dxf)
- [SVG export](poc1-cabinet-layout/cnb-plc-panel.svg)
- [DXF audit](poc1-cabinet-layout/cnb-plc-panel.audit.json)
- [POC result](poc1-cabinet-layout/result.json)
- Adapter source: `../../experiments/oss/cabinet_layout_adapter.py`

The executable POC validates load, projection, rail/duct/component presence, and
export. Browser drag/move capture is a follow-up Phase A gate because the spike ran
the real exporter and model tests, not a long-lived hosted browser session.

The OSS web app was also started with `npm run dev -- --host 127.0.0.1 --port
4174`; a local `Invoke-WebRequest` smoke check returned HTTP 200 for `/`. No
interactive screenshot was claimed because this shell smoke did not exercise a
browser session.

## POC 2 - CNB DXF assets and mlightcad path

Command:

```text
python experiments/oss/mlightcad_dxf_poc.py
```

Result: source-ready / partial browser runtime. Three real Siemens DXFs were
parsed with ezdxf using the entity families exercised by mlightcad:

| Asset | Entities | Types | Bounds (mm) |
|---|---:|---|---|
| KTP700 | 13 | INSERT, LWPOLYLINE, TEXT | 420 x 297 |
| G120C | 546 | CIRCLE, HATCH, INSERT, LINE, LWPOLYLINE, MTEXT, TEXT | 677.6 x 349.25 |
| SITOP | 38 | CIRCLE, HATCH, INSERT, LINE, LWPOLYLINE, TEXT | 279.4 x 431.8 |

The mlightcad simple-viewer dependency chain built successfully. The full
workspace/example build was blocked by package build ordering/generated
declaration issues and the `cad-agent-plugin` pnpm version check. Therefore this
evidence proves source parsing and build viability, not a browser screenshot or
interactive selection acceptance.

Artifacts:

- [mlightcad census](poc2-mlightcad-census.json)
- Adapter source: `../../experiments/oss/mlightcad_dxf_poc.py`
- External build/test logs: [`../../evidence/test-logs/external/`](../../evidence/test-logs/external/)

## OSS build evidence

- Cabinet Layout Generator: `npm ci --ignore-scripts`, 62/62 tests, and production
  build passed. The build reports a bundle warning above 500 kB.
- sldeditor: library build and 256 tests passed. One element-library test suite
  failed before execution due to an upstream parser syntax error around an em dash
  in a comment; it is documented and not patched here.
- mlightcad: `pnpm install --frozen-lockfile` and the simple-viewer dependency
  chain built; full example build remains the blocker above.

See [`docs/architecture/OSS_EVALUATION_MANIFEST.md`](../../docs/architecture/OSS_EVALUATION_MANIFEST.md)
for pinned commits, licenses, commands, and decisions. The final architecture
decision is [`docs/architecture/R4_3_OSS_DECISION.md`](../../docs/architecture/R4_3_OSS_DECISION.md).
