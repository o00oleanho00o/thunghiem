# R4.3c - Cabinet Visual Review

Danh gia duoc thuc hien tren browser runtime that tai `http://127.0.0.1:4178/`.
Project la CNB `project_4de34d02badc`, plate `500 x 1100 mm`, 9 devices, 3 ducts,
va 2 rail proxies khoa. Rail proxy duoc ghi ro trong UI, khong phai DIN rail
native cua upstream.

## Evidence review

### `01-before-reflow-unlocked.png`

- Image: `evidence/r4-3c/cabinet/01-before-reflow-unlocked.png`
- What is visible: Plate, three ducts, two rail proxies, device labels, selected
  fixture tai `x=320 mm`, `locked: false`, issue list.
- Expected: Trang thai truoc reflow phai nhin duoc va fixture phai o vi tri lech
  co chu y.
- Observed: Dung. Fixture va rail/duct cung nam trong plate; issue overlap hien
  o panel phai.
- Visual defects: Duct text lon va overlap warning chu y; day la fixture co chu y.
- Severity: Low (test fixture).
- Decision: Accept lam baseline unlocked.

### `02-after-reflow-unlocked-moved.png`

- Image: `evidence/r4-3c/cabinet/02-after-reflow-unlocked-moved.png`
- What is visible: Cung fixture sau reflow tai `x=257.4 mm`; panel ghi reflow
  da move danh sach elements.
- Expected: Unlocked fixture phai di chuyen it nhat 30 mm va thay doi phai doc
  duoc trong runtime debug panel.
- Observed: Dung, delta `62.6 mm`; geometry thay doi theo hang va van nam trong
  plate.
- Visual defects: Khong co crop hay che doi object; warning overlap van thay.
- Severity: None beyond intentional fixture warnings.
- Decision: Accept.

### `03-before-reflow-locked.png`

- Image: `evidence/r4-3c/cabinet/03-before-reflow-locked.png`
- What is visible: Cung fixture tai `320,705 mm`, panel ghi `locked: true`,
  nut doi thanh `Unlock selected`.
- Expected: Lock state phai ro rang truoc reflow va khong bi hieu nham la rail
  native.
- Observed: Dung; selected ID, toa do va lock state hien dong thoi.
- Visual defects: Rails cung dung mau do nhu duct, nhung header va panel ghi
  `rail proxies`, nen khong tao claim native.
- Severity: Low.
- Decision: Accept voi guardrail van giu rail semantics trong CNB EIR.

### `04-after-reflow-locked-unchanged.png`

- Image: `evidence/r4-3c/cabinet/04-after-reflow-locked-unchanged.png`
- What is visible: Reflow panel ghi `locked [device_e31f877b1100]`; selected
  fixture van tai `320,705 mm`.
- Expected: Locked fixture khong duoc reflow movement, khong phu thuoc vao viec
  vo tinh quay ve vi tri cu.
- Observed: Dung; locked delta `0 mm`, cac element movable moi bi reflow.
- Visual defects: Khong co.
- Severity: None.
- Decision: Accept lam evidence lock semantics.

### `05-export-result.png`

- Image: `evidence/r4-3c/cabinet/05-export-result.png`
- What is visible: Runtime view sau export, status `SVG ready; DXF ready`, plate
  va placements van khop voi editor.
- Expected: Export phat sinh tu browser runtime va UI phai xac nhan ca SVG/DXF.
- Observed: Dung; `runtime-export.svg` va `runtime-export.dxf` duoc tao va DXF
  duoc ezdxf audit.
- Visual defects: Khong co.
- Severity: None.
- Decision: Accept; artifact audit van la gate doc lap.

## Overall decision

Visual evidence du de ket luan **CABINET PASS** cho runtime acceptance. Khong
promote rail semantics thanh native; tiep tuc map rail nhu locked visual proxy
va giu EIR/CNB lam source of truth trong dual-run.
