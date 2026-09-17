# R4.3c - Bao cao dong correctness va visual gate

Ngay danh gia: 2026-09-17
Branch: `cnb-electrical-lab-r4-3c-runtime-correctness-visual-gate`
Base runtime head: `800fce7`

## Ket luan

**R4.3c PASS - OSS RUNTIME CORRECTNESS CLOSED.**

Cabinet va mlightcad deu da qua browser runtime gate; mlightcad G120C bounds
mismatch duoc giai thich bang MTEXT overlay extent theo dung apples-to-apples
comparison. Khong co visible geometry loss trong stress case.

## Cabinet

- Lock bug la rui ro co that: reflow adapter truoc day co the dua locked element
  vao movement path.
- Da fix o runtime host: locked IDs bi loai khoi reflow movement, movable elements
  reflow xung quanh locked anchors.
- Differential fixture: unlocked `320 -> 257.4 mm`, delta `62.6 mm`; locked
  `320 -> 320 mm`, delta `0 mm`.
- `lock_semantics_pass: true`; export SVG/DXF tu browser runtime va ezdxf audit
  deu pass.
- Rail van la locked visual proxy, khong claim DIN rail native.

## mlightcad

- KTP700: 13 model entities, 58 rendered geometry records, bounds `420 x 297`.
- G120C: 546/546, rendered bounds `529.35 x 349.25`; source full/visible
  `677.60 x 349.25`. Phan thieu `148.25 mm` la MTEXT handle 80, visible, identity
  transform, da render thanh overlay; `activeLayout.box` khong gom overlay.
- SITOP: 38 model entities, 79 rendered geometry records; model bounds `279.4 x
  431.8` (rendered bounds theo active layout `420 x 396` do block/render extents,
  asset van hien va gate rendered > 0 pass).
- Selection metadata, layer inventory, block ancestry va camera deep zoom hoat
  dong; khong co page error.
- Input guard preflight extension/size/DXF markers/meaningful entity; invalid bytes
  bi reject, error hien, last valid scene retained; valid load sau invalid pass.
- Khong dung `AcDbDatabase.read` temporary path do browser hang; adapter giu
  structural preflight + post-open non-empty validation + last-valid restore.

## Visual gate

- Cabinet: 5 PNG before/after/lock/export da review truc tiep.
- mlightcad: 6 PNG fit/overlay/highlight/deep zoom/error/recovery da review truc
  tiep.
- `evidence/r4-3c/visual-index.json` co app, URL, scenario, action, expected va
  observed cho tung anh.
- `evidence/r4-3c/CONTACT_SHEET.png` va `.md` cung cap review nhanh theo section.

## R5 gate

Du dieu kien sang R5 chi cho adapter/panel dual-run va CNB engineering work; khong
mo generic CAD feature moi. DXF viewer co the promote theo pham vi DXF MIT path,
voi legacy fallback va khong bat DWG/GPL converter. CNB EIR, provenance, rules va
validation policy van la source of truth.
