# CNB Electrical Lab — Product Overview

## Chúng ta đang xây gì?

CNB Electrical Lab là một prototype của **AI-assisted Electrical Engineering System**. Mục tiêu dài hạn là hiểu dữ liệu kỹ thuật lộn xộn, biến nó thành yêu cầu có cấu trúc, đề xuất BOM và thiết bị có nguồn gốc, kiểm tra khả năng vừa tủ, hỗ trợ bố trí và xuất artefact để kỹ sư đưa vào quy trình sản xuất.

Đây không chỉ là một AutoCAD clone, wire-routing software, hay một nỗ lực thay thế EPLAN ngay lập tức. AI không được phép tự vẽ hoặc tự quyết định an toàn điện. Ranh giới trách nhiệm là:

```text
AI đề xuất / trích xuất
Rules và solver xác nhận hình học, ràng buộc, tính lặp lại
Engineer review và phê duyệt quyết định cuối cùng
```

Luồng dài hạn:

```text
PDF / BOQ / BOM / Specification / Drawing
        ↓
      AI extraction
        ↓
Structured Engineering Requirement
        ↓
BOM Candidate → Verified Component Catalog
        ↓
Cabinet Candidates → Fit / Capacity / Auto Layout
        ↓
Engineer Review
        ↓
DXF + BOM + Engineering Report → ERP / Purchasing / Production
```

## Vì sao có giá trị cho DH?

DH có hai hoạt động bổ trợ nhau nhưng thường bị tách dữ liệu:

1. **Dự án M&E**: BOQ, bản vẽ, specification, hồ sơ thầu, Excel và báo giá vendor được bóc tách, chuẩn hóa và chọn thiết bị.
2. **Nhà máy tủ điện**: engineering chuyển thành BOM, layout, mua hàng, kho, lắp ráp và QC/FAT.

Tên thiết bị không đồng nhất, revision thay đổi, BOM engineering dễ lệch production BOM và rất khó biết sớm một BOM có vừa tủ hay không. Project này tìm cách tạo một engineering intelligence bridge giữa hai phía, không ép DH bỏ ngay CAD hoặc ERP đang dùng.

## Product wedge hiện tại

```text
Messy project data → engineering BOM → real component geometry
                   → cabinet fit → layout feasibility → engineer approval
```

Đây là candidate differentiation, chưa phải tuyên bố độc quyền: AI-first, manufacturer-agnostic, pre-engineering, web-first và có đường tích hợp ERPNext.

## Component thật, không chỉ rectangle

Một component chuẩn gồm:

```text
Product Identity
├─ type designation / manufacturer order code
├─ Engineering Footprint (envelope, mounting, clearance)
├─ DXF / vector representation
├─ Provenance của từng giá trị quan trọng
└─ Engineering rules và trạng thái review
```

Solver có thể dùng envelope đơn giản để tính collision và capacity; renderer phải có khả năng hiển thị vector DXF thật. Một file DXF không đồng nghĩa với một product đã được xác minh. Unknown phải ở lại unknown cho tới khi có bằng chứng.

## Trạng thái đã chứng minh

### R2 / R2A

Đã chứng minh pipeline deterministic từ BOM/EIR → layout → validation → DXF; solver chạy, DXF reopen được và lock/regenerate hoạt động. Chưa chứng minh engineering data truth.

### R2B

Đã thử vendor verification với Siemens catalog. Kết quả quan trọng: CAD file không tự biến thành verified engineering component; MPN và kích thước không được suy đoán khi nguồn không đủ.

### R3

Đã thêm Product Identity, provenance, clearance/accessibility checks, authoritative export gate và canonical EIR revisions. Review-verified vẫn chưa đủ mạnh cho manufacturing.

### R3.1 / R3.1b

Đã dùng official cached ABB artifact có SHA256, provenance theo field, phân biệt `document_verified`, `engineering_default` và `unknown`, nested canonical hash, source-artifact export chain và manufacturing blockers. Tám ABB S201U-C variants có type designation và order code riêng.

**Kết luận hiện tại:** `R3 CLOSED — GO TO R4 LIMITED`. Đây là engineering-layout-grade, chưa manufacturing-ready. Clearance, service access và terminal model chưa được phép nâng thành verified nếu nguồn chưa nói rõ.

## Lộ trình

| Milestone | Câu hỏi cần trả lời | Kết quả mong đợi |
|---|---|---|
| R3.1b | Giá trị engineering nào thực sự có bằng chứng? | Component truth model đáng tin |
| R4 | Kéo thiết bị thật vào tủ được không? | Real DXF Cabinet Composer |
| R5 | BOM này cần tủ nào? | So sánh fit/capacity nhiều enclosure |
| R6 | Excel/BOQ/PDF → BOM chuẩn hóa? | BOM Intelligence |
| R7 | Requirement → BOM candidate? | AI-assisted candidate design |
| R8 | Chạy pilot trên cabinet thật của DH? | Đo thời gian, corrections, usefulness |
| R9 | Wedge thương mại nào đáng tập trung? | Product decision dựa trên evidence |

Không làm ngay full EPLAN replacement, schematic editor đầy đủ, production-grade wire routing, 3D, thermal simulation, NC machining hoặc unrestricted automatic engineering. Những hướng đó mở rộng scope quá sớm và đưa project đối đầu trực tiếp với EPLAN, Zuken, WSCAD và Siemens Capital.

## Nguyên tắc

- Engineering truth trước AI automation.
- Real components, not fake rectangles.
- AI proposes; deterministic rules validate.
- Engineer remains in control.
- Một canonical engineering model.
- Mọi giá trị quan trọng cần provenance.
- Tích hợp CAD/ERP hiện có khi hữu ích, không thay thế chỉ vì có thể.

## Evidence đọc tiếp

- [R2 real cabinet report](../r2/R2_REAL_CABINET_REPORT.md)
- [R2B verified Siemens report](../r2/R2B_VERIFIED_SIEMENS_REPORT.md)
- [R3 engineering truth report](../r3/R3_ENGINEERING_TRUTH_REPORT.md)
- [R3.1 truth closure report](../r3/R3_1_TRUTH_CLOSURE_REPORT.md)
- [R3 benchmark results](../r3/R3_BENCHMARK_RESULTS.md)
- [Siemens DXF catalog audit](../research/SIEMENS_DXF_CATALOG_AUDIT.md)
