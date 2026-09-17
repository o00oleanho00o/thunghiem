# R4.3b runtime evidence

Evidence duoc tao tu browser runtime that ngay 2026-09-17.

## Cabinet Layout Generator

- URL/port: `http://127.0.0.1:4178/`
- Asset/project: CNB `project_4de34d02badc`, `poc1-cabinet-layout-model.json`
- Actions: load, select, drag 41 mm, lock, reflow, overlap/off-plate/missing
  library validation, SVG/DXF export, ezdxf audit.
- Expected: selection/placement state thay doi; locked component khong bi reflow;
  validation hien warning; export la artifact tu runtime.
- Result: `cabinet/runtime-result.json` - all required checks true.

## mlightcad

- URL/port: `http://127.0.0.1:4179/`
- Assets: KTP700, G120C, SITOP tu `catalog/siemens-bilddb/*.dxf`.
- Actions: file input that, Fit, deep zoom, middle-button pan, selection,
  layer refresh, block/entity inspection.
- Expected: geometry render > 0, camera state doi, entity metadata/layers/blocks
  doc duoc, bounds so sanh voi ezdxf.
- Result: `mlightcad/mlightcad-runtime-result.json`.
- Blocker ghi nhan: G120C runtime bounds khong khop full ezdxf extents; malformed
  va empty payload tro thanh empty document thay vi giu scene hop le.

## Screenshot map

| File | App | Asset | Action / expected |
|---|---|---|---|
| `cabinet/01-loaded-cnb-project.png` | Cabinet | CNB project | plate, 9 devices, 3 ducts, 2 rail proxies visible |
| `cabinet/02-selected-component.png` | Cabinet | CNB project | selected state visible |
| `cabinet/03-after-drag.png` | Cabinet | CNB project | placement moved 41 mm |
| `cabinet/04-lock-state.png` | Cabinet | CNB project | selected component locked |
| `cabinet/05-snap-or-reflow.png` | Cabinet | CNB project | locked placement unchanged after reflow |
| `cabinet/06-overlap-warning.png` | Cabinet | CNB project | overlap warnings visible |
| `cabinet/07-export-result.png` | Cabinet | CNB project | runtime export status visible |
| `mlightcad/ktp700-fit.png` | mlightcad | KTP700 | fit render visible |
| `mlightcad/ktp700-deep-zoom.png` | mlightcad | KTP700 | 5x-equivalent deep zoom |
| `mlightcad/g120c-fit.png` | mlightcad | G120C | stress drawing render visible |
| `mlightcad/g120c-selected-entity.png` | mlightcad | G120C | entity id/type metadata visible |
| `mlightcad/sitop-fit.png` | mlightcad | SITOP | fit render visible |
| `mlightcad/layers.png` | mlightcad | KTP700 | layer inventory visible |
| `mlightcad/block-inspection.png` | mlightcad | KTP700 | INSERT/block inventory visible |
