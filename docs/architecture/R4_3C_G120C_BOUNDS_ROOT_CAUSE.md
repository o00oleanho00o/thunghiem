# R4.3c - G120C Bounds Root Cause

## Ket qua do

Asset: `catalog/siemens-bilddb/sinamics-g120c-sinamics-g120c-fsd-g-sd01-xx-00631.dxf`.

| Baseline | Bounds | Width x height |
|---|---|---:|
| ezdxf full model-space | `minX=-152.5997`, `maxX=525`, `minY~=0`, `maxY=349.25` | `677.5997 x 349.25` |
| ezdxf visible source | giong full source | `677.5997 x 349.25` |
| mlightcad full model runtime | `minX=-4.8`, `maxX=525`, `minY~=0`, `maxY=349.25` | `529.8 x 349.25` |
| mlightcad rendered active layout | `minX=-4.35`, `maxX=525`, `minY=0`, `maxY=349.25` | `529.35 x 349.25` |

Chenhlech la `148.25 mm` phia min-X. Full source va visible source giong nhau,
nen khong phai hidden/off/frozen layer.

## Entity audit

`evidence/r4-3c/mlightcad/g120c-left-extent-entities.json` liet ke day du
entity, layer, ancestry, bbox, visibility, transform va rendered status. Chi co
mot entity cham left extent:

- handle `80`, type `MTEXT`, layer `70_GS`;
- ancestry `8B -> EPLFRAME`;
- local va world bbox `[-152.5997, 0] .. [0, 21.0954] mm`;
- visibility `true`, entity invisible flag `0`, layer khong hidden/frozen;
- transform identity 4x4;
- `rendered_by_mlightcad: true`.

## Root cause

mlightcad da render MTEXT 80 thanh text overlay nhung `activeLayout.box` va batch
render bounds chi phan anh geometry batch, khong cong phan extent cua text overlay.
Vi vay renderer khong mat visible geometry; chi la hai phep do bounds dang do hai
khong gian khac nhau.

Khong co dau hieu cua:

- layer visibility sai;
- block INSERT transform sai;
- nested block omission;
- HATCH/unsupported entity omission;
- paper/model-space nham;
- clipping lam mat entity.

## Visual proof

- `01-g120c-runtime-fit.png`: toan bo drawing rendered, bao gom text trai.
- `02-g120c-bounds-overlay.png`: xanh la rendered bounds, do dashed la full va
  visible source bounds, cho thay phan text overlay mo rong sang trai.
- `03-g120c-left-extent-highlight.png`: khung hong gan nhan `MTEXT 80 left
  extent` dung tai vung `-152.6 .. 0 mm`.
- `04-g120c-deep-zoom-left-side.png`: deep zoom van thay text/khung left extent,
  khong co visible geometry loss.

## Decision

Bounds gate duoc dong theo apples-to-apples: full source so voi full model
runtime, visible source so voi rendered runtime. G120C mismatch duoc giai thich
boi MTEXT overlay extent, khong noi tolerance. mlightcad dat **PASS_EXPLAINED_BOUNDS**
cho fixture DXF-only nay; van khong mo DWG/GPL converter.
