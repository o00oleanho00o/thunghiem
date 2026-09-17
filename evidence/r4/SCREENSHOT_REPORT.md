# R4 Evidence

Captured against the running app at `http://127.0.0.1:4177/` using the existing
catalog/vector-cache data.

| File | Evidence |
|---|---|
| `01-real-dxf-library.png` | Real DXF library filtered to 10 cards with explicit millimetre units |
| `02-placed-real-dxf.png` | Preview composer after direct asset drop; vector geometry appears in cabinet |
| `03-deep-zoom-500-percent.png` | 500% deep zoom state |
| `04-lock-regenerate.png` | Locked component retained after auto-layout regeneration |
| `05-asset-detail-three-statuses.png` | Detail view showing geometry, identity and physical-mapping statuses separately |

The automated R4 UI contract confirms 10 unit-confirmed library cards, direct
asset drag/drop, 6 semantic CAD component instances after the drop, 6 rendered
vector images, and lock/regenerate preserving the locked component coordinates.

The R4 export audit is recorded by `scripts/audit_dxf_ezdxf.py`:
`AC1009`, 12,911 entities, `CAD_GEOMETRY` layer present, and bounds 1600 ×
1100. This is a preview export (`authoritative=false`) because all selected
assets have unknown physical mapping.
