# R5 Runtime Topology: Before and After

## Before R5

R4.3c had two proven runtime hosts used for acceptance evidence:

```text
browser -> cabinet-layout-runtime :4178
browser -> mlightcad-runtime      :4179
```

The legacy `apps/web` process also contained the CNB panel composer and API
routes. This was useful for isolated proof, but it left panel, source CAD,
validation and export in separate runtime entry points.

## After R5

The canonical path is one web shell and one API:

```text
browser
  -> Engineering Web :4200
       |-- overview / BOM / devices / validation / export
       |-- PanelLayoutAdapter -> proven CNB panel composer
       `-- CadViewerAdapter   -> pinned mlightcad DXF runtime in shared DOM
  -> Engineering API :8200
       |-- EIR project and candidate placement routes
       |-- catalog and source DXF routes
       `-- CNB export and audit modules
```

`services/engineering-api/server.js` is a modular-monolith boundary. It sets
the API port and service identity, then loads the proven `apps/web/server.js`
modules. It does not launch a second OSS service.

## Request and state ownership

1. The Web loads `examples/r5-real-cabinet/project.json` through
   `GET /api/projects/:id`.
2. `PanelLayoutAdapter` projects EIR placements into the panel editor.
3. User edits remain candidate state; `POST /api/projects/:id/placements`
   returns a deterministic R5 revision.
4. `CadViewerAdapter` resolves the EIR asset ID through
   `GET /api/cad-assets/:assetId`, creates a `.dxf` File with the catalog
   basename and dispatches it to the embedded runtime.
5. Validation and artifact audit call the Engineering API. CNB owns rule and
   export semantics; OSS owns generic rendering and interaction.

## Why this topology is canonical

- one project route family and one navigation shell;
- one API ownership boundary for EIR, candidate revisions and artifacts;
- no iframe or second product runtime for CAD;
- adapters hide Fabric/Three implementation details from CNB domain code;
- experimental 4178/4179 hosts remain available for regression comparison but
  are not part of the R5 production-like process count.
