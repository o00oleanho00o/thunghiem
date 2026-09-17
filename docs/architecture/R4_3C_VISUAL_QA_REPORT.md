# R4.3c - Visual QA Report

Review truc tiep cac PNG vua tao boi Playwright, khong chi kiem tra file ton tai.
Branch review: `cnb-electrical-lab-r4-3c-runtime-correctness-visual-gate`.

| Image | Observed visually | Potential issue | Is it expected? | Action |
|---|---|---|---|---|
| `cabinet/01-before-reflow-unlocked.png` | Plate, 9-device layout, 3 ducts, 2 rail proxies, fixture `320 mm`, warnings ro. | Intentional overlap fixture. | Co, day la baseline negative. | Giu; dung lam before state. |
| `cabinet/02-after-reflow-unlocked-moved.png` | Fixture o `257.4 mm`, reflow list va delta duoc panel ghi. | Warning van hien. | Co, fixture van co overlap can audit. | Giu; chung minh unlocked moved. |
| `cabinet/03-before-reflow-locked.png` | Lock state true, nut unlock, selected ID va toa do ro. | Rail proxy co the bi nham native neu chi nhin canvas. | Mot phan; panel/header da ghi proxy. | Giu guardrail va khong doi label. |
| `cabinet/04-after-reflow-locked-unchanged.png` | Reflow ghi locked ID; toa do van `320,705`. | Khong co. | Khong. | Giu lam evidence differential. |
| `cabinet/05-export-result.png` | Status `SVG ready; DXF ready`, runtime view khop editor. | Khong co. | Khong. | Giu; doi chieu them ezdxf audit. |
| `mlightcad/01-g120c-runtime-fit.png` | G120C geometry hien ro tren canvas trang, panel ghi 546/546. | Text nho do drawing co nhieu annotation. | Co, fit overview. | Giu; them deep zoom. |
| `mlightcad/02-g120c-bounds-overlay.png` | Rendered rectangle xanh nam trong full/visible dashed rectangle do-cam. | Label overlay sat bien trai nhung khong che geometry chinh. | Co, debug overlay co chu y. | Giu. |
| `mlightcad/03-g120c-left-extent-highlight.png` | Khung hong va label MTEXT 80 bao vung text trai. | Label overlay chen gan goc canvas. | Co, can chi ro entity gay mismatch. | Giu; audit JSON la source chi tiet. |
| `mlightcad/04-g120c-deep-zoom-left-side.png` | Zoom ~5x-equivalent, left text va khung bounds van thay. | Mot so label overlay sat canh trai. | Co, deep zoom debug state. | Giu; khong crop them. |
| `mlightcad/05-invalid-dxf-rejected.png` | Status reject + last valid scene retained; KTP geometry van hien. | KTP fit nho trong overview. | Co, muc tieu la error + retention. | Giu; bridge ghi 13 entities/58 rendered. |
| `mlightcad/06-valid-scene-retained.png` | SITOP load lai sau invalid, geometry hien, status Loaded, 38/79. | Drawing fit co khoang trang do ty le asset. | Co, phu hop bounds 279.4 x 431.8. | Giu; khong xem la blank canvas. |

## Gate result

Khong co anh nao bi crop sai, canvas trang do loi render, text che object chinh,
hoac khong chung minh action. Layout CSS da duoc gioi han theo viewport de aside
khong day canvas ra ngoai man hinh; nen WebGL duoc dat trang de geometry den ro.
