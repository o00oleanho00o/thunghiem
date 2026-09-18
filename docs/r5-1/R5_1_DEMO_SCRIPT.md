# R5.1 one-click demo

## Chạy

    npm run demo

Mở Chrome tại http://127.0.0.1:8080/demo. Demo là một tiến trình Node duy nhất, không cần API riêng, CDN, LLM, ERPNext hay database.

## Luồng trình diễn

1. Màn hình **BOM thiết bị** hiển thị 18 thiết bị ở trạng thái unplaced.
2. Bấm **Tạo phương án tự động**. Engine deterministic đo thời gian bằng process.hrtime.bigint(), xếp thiết bị lên 3 DIN rail/4 duct và chạy validation plate bounds, overlap, candidate mapping.
3. Chọn thiết bị trên canvas hoặc BOM để xem **Product Truth**: tag, manufacturer, order code, kích thước, mounting và trạng thái CAD.
4. Với -H18, bấm **Xem CAD nguồn**. DXF thật được tải từ catalog và đưa vào runtime mlightcad trong modal; đây là CAD candidate, không dùng làm manufacturing footprint.
5. Bấm **Khóa vị trí**, sau đó **Tối ưu phần còn lại**. Thiết bị đã khóa giữ nguyên tọa độ, các thiết bị còn lại được bố trí lại.
6. Bấm **Xuất hồ sơ** để nhận Layout DXF, BOM CSV và audit entity/section.

## Kiểm thử tự động

    npm run test:r51

Gate kiểm tra health, URL /demo, 18 unplaced, 18 placements, measured duration, lock/re-layout, CAD source và DXF audit.