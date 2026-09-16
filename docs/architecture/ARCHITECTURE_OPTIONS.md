# Architecture Options

The mission tested three realistic compositions rather than assuming that a
single existing ECAD application can be embedded unchanged.

| Option | Shape | Strengths | Risks | Prototype evidence |
|---|---|---|---|---|
| A: Web-first TypeScript | React/Vite editor, EIR service, browser SVG/DXF adapter, Python solver | Fast browser UX, easy collaboration, deterministic renderer can be shared by export and preview | Electrical semantics must be owned; JS/Python schema drift is a real risk | `apps/web`, `packages/cad-export`, `apps/web/eir-adapter.js`; external `sldeditor` build passed |
| B: Python engineering backend | FastAPI/Pydantic EIR, OR-Tools, ezdxf, thin web client | Strong numerical/tooling ecosystem, straightforward headless validation and batch generation | Browser canvas still needs a separate client model; Python package deployment is heavier | `packages/domain_model`, `layout_engine`, `validation`, `cad_export`; OR-Tools and ezdxf ran in `.venv` |
| C: Existing ECAD core | QElectroTech/LibrePCB/sldeditor process or adapter behind a web shell | Mature symbol/connectivity concepts and libraries can accelerate research | Process boundary, persistence/licensing, UI coupling, and panel-layout gaps make product behavior hard to control | QElectroTech/LibrePCB cloned; `sldeditor` 256 tests passed with one source syntax failure and build passed |

## Score (1 low, 5 high)

| Criterion | A | B | C |
|---|---:|---:|---:|
| Development speed for wedge | 5 | 4 | 2 |
| Engineering correctness/control | 4 | 5 | 3 |
| Browser UX | 5 | 4 | 2 |
| DXF path | 4 | 5 | 3 |
| AI structured-intent integration | 5 | 5 | 3 |
| 3D extension path | 3 | 5 | 4 |
| Licensing/commercial clarity | 4 | 4 | 2 |
| Maintainability | 4 | 5 | 2 |
| Total | 34 | 37 | 21 |

The scores are decision aids, not benchmarks. Option C remains valuable as a
reference/process adapter, but its UI and data contracts should not become the
commercial core without a separate integration spike.

