# R5 Contact Sheet

Branch: `cnb-electrical-lab-r5-unified-engineering-workbench`

The contact sheet is generated from the 13 screenshots captured by
`scripts/test_r5_unified_workbench.cjs`. Each image is a browser state that
proves one part of the canonical Engineering Web workflow.

| Image | Route | Purpose |
|---|---|---|
| [01-project-overview.png](01-project-overview.png) | `/projects/r5-real-cabinet` | Canonical project, EIR revision, Draft workflow and two-process topology. |
| [02-bom.png](02-bom.png) | `/bom` | Three Siemens parts and candidate mapping status. |
| [03-panel-loaded.png](03-panel-loaded.png) | `/panel` | Panel plate, DIN rails, ducts and three device projections. |
| [04-panel-selected-device.png](04-panel-selected-device.png) | `/panel` | ProductIdentity, order code, footprint, provenance and CAD link inspector. |
| [05-panel-after-drag.png](05-panel-after-drag.png) | `/panel` | Candidate placement moved by drag while remaining Draft. |
| [06-panel-locked-reflow.png](06-panel-locked-reflow.png) | `/panel` | Locked HMI anchor remains fixed during candidate reflow. |
| [07-cad-ktp700.png](07-cad-ktp700.png) | `/cad` | KTP700 source DXF rendered by embedded mlightcad. |
| [08-cad-g120c.png](08-cad-g120c.png) | `/cad` | G120C source DXF rendered in the same shell. |
| [09-cad-selection-layer.png](09-cad-selection-layer.png) | `/cad` | Bounds, left extent, entity selection and layer inventory. |
| [10-panel-to-cad-navigation.png](10-panel-to-cad-navigation.png) | `/cad` | VFD1 context retained across panel-to-CAD navigation. |
| [11-validation.png](11-validation.png) | `/validation` | CNB validation view and review gate. |
| [12-export-result.png](12-export-result.png) | `/export` | Engineering API audit response with `valid: true`. |
| [13-invalid-dxf-retained.png](13-invalid-dxf-retained.png) | `/cad` | Malformed DXF rejected while the valid G120C scene remains rendered (546 entities). |

The PNG contact sheet is [CONTACT_SHEET.png](CONTACT_SHEET.png).
