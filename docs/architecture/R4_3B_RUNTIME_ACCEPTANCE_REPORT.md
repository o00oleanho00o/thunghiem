# R4.3b - Bao cao chap nhan runtime OSS

> **Trang thai lich su:** Bao cao nay ghi lai ket qua tai R4.3b. Ket qua hien
> hanh da duoc dong tai R4.3c: **R4.3c PASS - OSS RUNTIME CORRECTNESS CLOSED**.
> Cabinet tiep tuc PASS; mlightcad da giai thich G120C bounds bang MTEXT overlay
> va da them input guard/last-valid-scene retention. Chi tiet va visual evidence
> nam trong `R4_3C_CORRECTNESS_CLOSURE_REPORT.md`.

Ngay danh gia: 2026-09-17
Branch: `cnb-electrical-lab-r4-3b-oss-runtime-acceptance`
Ket qua: **R4.3b PARTIAL - CABINET PASS / MLIGHTCAD BLOCKED**

## Tom tat

R4.3b da chung minh browser runtime that cho hai upstream OSS, khong chi build
hoac census offline. Cabinet Layout Generator dat day du gate runtime va co the
duoc tiep tuc qua `PanelLayoutAdapter` trong dual-run. mlightcad da load/render
duoc ca ba DXF Siemens va ho tro tuong tac, nhung chua du dieu kien promote lam
DXF viewer mac dinh.

## Cabinet Layout Generator

- Upstream: `0633b013dc65d13055b8f3765a27425cb58ec510` (MIT).
- URL: `http://127.0.0.1:4178/`.
- CNB model: `project_4de34d02badc`, plate `500 x 1100 mm`, 9 devices, 3 ducts.
- Rails: 2 locked visual rail proxies; upstream khong co DIN rail semantics native.
- Playwright: 17/17 checks true, khong co page error.
- Selection: component `device_e31f877b1100` selected.
- Drag: delta `41 mm`; max frame gap `16.8 ms`, khong co jank ro rang.
- Lock/reflow: vi tri khoa `131,705` mm khong doi sau reflow.
- Validation: overlap, off-plate va missing-library warning/error deu xuat hien.
- Export: SVG `3,665` bytes; DXF `63,327` bytes; ezdxf audit `29` entities, valid.
- Timing: startup `352 ms`, model load/first render `84.9 ms`, SVG `1.6 ms`,
  DXF `29.4 ms`; production JS bundle `1,398,142` bytes.

Ket luan: **CABINET PASS** cho runtime acceptance. Chi promote sau dual-run va
giu CNB EIR/provenance/topology lam source of truth.

## mlightcad / cad-viewer

- Upstream: `44cfd514b2d0c56346034f49b499b65c53ed2a70` (core MIT).
- URL: `http://127.0.0.1:4179/`.
- Host import truc tiep `@mlightcad/cad-simple-viewer` va Three renderer.
- 15 checks: 14 true; bounds parity la check that bai.
- KTP700: 13 entities, 58 rendered geometry records, 326 layers, 4 blocks;
  bounds `420 x 297`, khop ezdxf trong tolerance.
- G120C: 546 entities, 546 rendered, 10 layers, 1 block; bounds runtime
  `529.35 x 349.25` so voi ezdxf `677.60 x 349.25`, thieu extents ben trai
  `148.25 mm`.
- SITOP: 38 entities, 78 rendered geometry records, 350 layers, 5 blocks;
  bounds `279.40 x 431.80`, khop ezdxf trong tolerance.
- Tuong tac: KTP700 deep zoom `>=5x` (fixture ghi `12.067x`), pan doi camera;
  G120C selection tra entity id `8B` va type `BlockReference`; populated layer
  `EPLAN108` da duoc toggle tu visible sang hidden.
- Performance: load `155-197 ms`; first visible/render `1.1-2.9 s`; browser
  responsive, khong co page error.
- Negative cases: malformed DXF va empty payload bi chap nhan thanh empty
  document, thay the scene hop le hien tai. Day la behavior can adapter chặn.

Ket luan: **MLIGHTCAD BLOCKED** cho promotion. Runtime render da dat, nhung
G120C bounds va input safety chua dat gate.

## Quyet dinh va R5 gate

Panel editor co the tiep tuc o che do OSS qua adapter, voi legacy fallback va
dual-run. DXF viewer mlightcad chi la candidate DXF-only, chua duoc promote.
Khong xoa legacy, khong them DWG/LibreDWG, va khong bat dau R5 feature work cho
den khi giai quyet bounds parity G120C va giu lai scene hop le khi input loi.

## Evidence

- Cabinet screenshots, exports, audit, result: `evidence/r4-3b/cabinet/`
- mlightcad screenshots va result: `evidence/r4-3b/mlightcad/`
- Script Cabinet: `scripts/test_r43b_cabinet_runtime.cjs`
- Script mlightcad: `scripts/test_r43b_mlightcad_runtime.cjs`
