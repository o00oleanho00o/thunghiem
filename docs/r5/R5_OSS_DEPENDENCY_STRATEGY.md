# R5 OSS Dependency Strategy

## Adopted dependencies

### Cabinet layout

R5 reuses the proven Cabinet Layout Generator panel composer already present in
the repository and exposes it through `PanelLayoutAdapter`. The adapter maps
EIR enclosure, plate, rails, ducts and placements to the editor model, then
maps placements back to CNB-shaped records. CNB keeps product truth, clearance
policy, workflow and approval semantics.

The choice is **wrap and dual-run**, not a new fork or a domain-core import.
This keeps the panel editor mechanics replaceable and avoids duplicating a
generic canvas implementation.

### mlightcad

The pinned MIT DXF path is bundled as
`apps/engineering-web/public/vendor/mlightcad-runtime.js` with its CSS. The
bundle is loaded only when the CAD route is opened, through
`CadViewerAdapter`. It supplies DXF parse/render, Three viewport mechanics,
selection, layers, blocks and camera operations.

Only DXF is in scope. Optional DWG converters, including GPL/proprietary
components, are not bundled or referenced by the R5 runtime. The API serves
catalog DXF bytes and the adapter preserves the catalog filename and asset ID
boundary.

## Kept in CNB

- EIR and project revisions;
- ProductIdentity, ManufacturerPart, footprint and provenance;
- candidate/Reviewed/Approved workflow;
- engineering validation policy and issue ownership;
- BOM intelligence and catalog decisions;
- deterministic CNB DXF/SVG export and audit;
- adapter contracts and evidence generation;
- future AI intent/tool orchestration.

## Deferred or reference-only

| Candidate | R5 decision | Reason |
|---|---|---|
| `NovaShang/sldeditor` | Survey only | No schematic acceptance surface is required for the unified cabinet demo. |
| `partcad/partcad` | Concept reference | Product packages are interesting, but adopting a second catalog/provenance substrate would add complexity before an electrical fit gate. |
| `ai-cad-labs/ai-cad` / CodeCAD | Pattern reference | Borrow typed intent, planner and critic ideas; do not let AI emit low-level DXF primitives. |
| WireViz | Later adapter | Wiring documentation is outside the R5 cabinet workflow. |
| FreeCAD/Cables | Survey only | 3D cabinet and cable routing are explicitly deferred. |

## Upgrade and license rules

- Pin the mlightcad source commit and retain upstream attribution when the
  vendor bundle is refreshed.
- Re-run the KTP700/G120C/SITOP load, selection/layer and invalid-input gates on
  every runtime upgrade.
- Keep GPL DWG tooling outside the distributed bundle unless a separate legal
  and procurement decision is made.
- Do not import OSS types into CNB EIR contracts; adapters remain the boundary.
- Do not replace candidate mappings with placement-capable truth without an
  engineering review artifact.
