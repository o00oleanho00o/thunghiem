# Recommended Architecture

Recommend **Option B with an Option A browser shell**:

```text
Browser editor (SVG/canvas view, drag/drop, inspector)
        |
        | versioned EIR JSON / HTTP
        v
Python engineering service
  Pydantic EIR + normalized catalog
  deterministic validation
  heuristic layout + bounded OR-Tools CP-SAT
  schematic projection / topology checks
  ezdxf-compatible DXF and SVG exporters
        |
        v
  JSON, DXF, SVG, later PDF/STEP
```

The current lab runs the service logic headlessly in `examples/run_core_demo.py`
and serves a dependency-free browser shell in `apps/web`. The JavaScript
`eir-adapter.js` is an explicit one-way projection from `eir.v1` to the view
model; it is not a second engineering model. Production should generate its
TypeScript types from the JSON schema or publish a single schema package to
remove this hand-maintained adapter.

## Build/borrow map

| Capability | Recommendation |
|---|---|
| Canonical EIR / component DB | Build and own normalized schema; seed only generic parts until vendor terms/data rights are confirmed |
| Schematic topology | Own adapter/projection; evaluate `sldeditor` for a browser surface and QElectroTech/KiCad formats for import/reference |
| Panel canvas | Own thin view over EIR; borrow snapping/selection ideas from cabinet-layout-generator and Maker.js |
| DXF parsing/audit | `ezdxf` server-side for round-trip/audit; keep a conservative ASCII R12 writer for deterministic export |
| DXF browser preview | Small adapter or `dxf-parser`; never make parsed geometry the source of truth |
| Auto-layout | Own domain-aware heuristic plus OR-Tools CP-SAT for bounded placement; solve per zone for scale |
| Wire routing | Own graph/duct network layer; start with A*/shortest path and occupancy checks |
| 3D | Defer full BREP; derive bounding-box/plate extrusion first, then server-side CadQuery/OpenCascade where justified |
| AI intent | Own provider interface and strict `DesignIntent` schema; model proposes no coordinates or DXF entities |
| Historical learning | Store reviewed layout variants and rule overrides per company; benchmark only after deterministic baseline is reliable |

## Operational boundaries

- Every mutation enters through a command that validates an EIR revision.
- Layout and export are pure functions over a revision plus catalog snapshot.
- A validation report is persisted alongside artifacts and shown in the UI.
- Imports retain original file hashes, source IDs, and confidence notes.
- Vendor catalog ingestion is an explicit licensed connector, not scraped data.

