# DH Company Opportunity

## Hai hoạt động, một chuỗi dữ liệu

### Khối dự án M&E

```text
BOQ / bản vẽ / specification / hồ sơ thầu / Excel / báo giá vendor
                              ↓
                 bóc khối lượng → báo giá → chọn thiết bị → engineering
```

Thực tế thường có nhiều Excel, tên thiết bị không đồng nhất, dữ liệu rời rạc, BOM thay đổi theo revision và ít khả năng reuse project cũ. AI có thể giúp extraction, normalize, classification và mapping, nhưng output chỉ là candidate cho kỹ sư review.

### Nhà máy sản xuất tủ điện

```text
Engineering → BOM → Cabinet layout → Purchasing → Warehouse
            → Assembly → QC / FAT
```

Khi engineering và ERP tách rời, production BOM dễ lệch, thay thiết bị gây ripple downstream và không ai biết sớm enclosure có đủ rail, duct, clearance hay reserve.

## Engineering Intelligence Bridge

```text
BOQ project → panel identification → cost sheet → BOM candidate
      → verified component catalog → cabinet fit / layout
      → engineer approval → production BOM → ERPNext
      → purchase / warehouse / manufacturing
```

Đây là cơ hội lớn hơn việc chỉ xây một CAD editor. CAD viewport là nơi kỹ sư nhìn và chỉnh kết quả; giá trị nằm ở chuỗi thông tin có provenance và có thể lặp lại.

## Use cases

### AI bóc BOQ

Ví dụ project có MDB, DB, ATS, MCC và PLC Panel. System nhận diện panel, thiết bị bên trong/ngoài panel, quantity, manufacturer/model nếu có và technical properties. Output là:

```text
Panel: MDB-2B
Candidate: MCCB / MCB / SPD / Meter / CT / Terminal
Status: verified | unknown | needs-review | candidate
```

### BOM intelligence

```text
Raw BOM → normalized description → manufacturer/type mapping
        → duplicate & missing-data review → catalog references
```

### Cabinet fit & selection

Với một BOM, engine thử 600×800, 800×1000, 800×1200 và 1000×1400 mm. Output phải nêu rõ fit/not fit, reserve, rail capacity, duct requirement, collisions, clearance violations và unplaced components. AI có thể đề xuất candidate; solver xác nhận.

## From Project BOQ to Factory

```text
BOQ dự án
↓
AI nhận diện 18 electrical panels
↓
Chọn MDB-2B → candidate BOM
↓
Map ABB / Schneider / Siemens catalog
↓
Engineer review → Engineering BOM
↓
Thử cabinet sizes → auto layout → engineer adjust
↓
Approve → Production BOM → ERPNext
↓
Purchase Request → Warehouse → Work Order → Assembly → QC / FAT
```

## Factory data quay lại engineering

```text
Actual material / substitutes / labor / cost / manufacturing issues
                            ↓
                  Engineering knowledge
                            ↓
                 estimation & future projects
```

Ví dụ insight có thể đo được: cabinet thường cần lớn hơn estimate, part X hay được thay bằng Y, layout pattern nào thường bị chỉnh và reserve nào không đủ. Đây là tiềm năng tạo learning loop của DH, không phải dữ liệu đã có sẵn hôm nay.

## Pilot metrics

- engineering hours trước/sau;
- mapping accuracy và tỷ lệ unknown;
- số lần chỉnh layout;
- số thay đổi BOM sau approval;
- độ hữu ích của cabinet recommendation;
- DXF có dùng được cho review và sản xuất hay không.
