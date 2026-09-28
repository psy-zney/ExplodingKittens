# Bàn chơi một màn hình — 2026-09-27

Đã triển khai tại workspace; chưa triển khai production. Bàn đỏ đậm, hai viền vàng rõ, nền navy và logo SVG riêng. Lượt đang chơi và bước cần phản hồi được đánh dấu trên bàn. Vòng đếm ngược nằm quanh avatar của người phải phản hồi, gồm avatar bản thân ở đầu tay bài; đổi vàng khi còn 10 giây và đỏ khi còn 5 giây. Chat, đồ chơi, lịch sử, trợ giúp, tự chơi và cài đặt nằm trong các menu gọn.

Chạm trực tiếp lá bài để chọn; lá đã chọn nhấc lên. Chọn hai hoặc ba lá cùng tên để ghép, chọn đối thủ bằng vị trí người chơi trên bàn. Xếp bài, bỏ chọn, chọn đối thủ, chọn loại bài yêu cầu và menu chỉ thay đổi trạng thái tại browser. Server vẫn xác thực các hành động game. Các bước bắt buộc, cứu nổ, chèn bài và thông tin riêng vẫn hoạt động.

Bộ mở rộng mặc định có 80 lá vật lý (ba bản mỗi loại mở rộng); bộ cơ bản vẫn có 56 lá. Số bài thực tế trong ván phụ thuộc số người và lá nổ/cứu nổ bị loại khi chuẩn bị. Thông báo công khai mô tả lá vừa đánh và kiểu ghép, có thông báo Nope/Cứu nổ. Xáo bài có hai chồng bài chuyển động tại bộ rút sau khi hiệu lực được xác nhận. Hiệu ứng tuân theo tùy chọn giảm chuyển động. Âm lượng SFX và kích thước hình thông báo đã giảm.

Mã phòng mới gồm sáu chữ số, giữ số 0 ở đầu; liên kết phòng cũ vẫn được chấp nhận. Ping đo RTT bằng acknowledgement và hiển thị ms, đo lại mỗi 15 giây khi tab hiện. Endpoint ping không phát snapshot và không thay đổi game. Đồng hồ dùng điểm giữa RTT để hiệu chỉnh thời gian server.

## Kiểm chứng

- `npm test`: 91 kiểm thử qua — engine 47, server 31, web 13. Bao gồm bộ bài mở rộng, scaling 2–5 người, quyền riêng tư, schema ping, chọn bài trực tiếp và các mốc timeout mới.
- `npm run typecheck`, `npm run build`, `npm run check:encoding`, `git diff --check`: qua.
- `scripts/table.e2e.spec.ts`: 7 kiểm thử qua, gồm bàn 5 người và sáu viewport: 1366×768, 390×844, 390×667, 360×640, 844×390, 547×287. Kiểm tra không cuộn trang khi chơi, đôi/bộ ba/++, lá nhấc lên, chọn đối thủ, mã số, ping, không phát gói server khi đổi UI cục bộ, thông báo trên hai client, hoạt ảnh xáo bài và chat.
- Kiểm thử hồi quy qua: thư viện bài và cài đặt VI/EN trên desktop/mobile; đôi/bộ ba/Favor và bàn phím; các lựa chọn bắt buộc Hamster; hủy tự chơi khi thao tác thủ công; chat/offline/kết nối lại.
- Ván đầy đủ qua trên hai browser desktop độc lập và hai browser bật giả lập cảm ứng mobile: rút bài, cứu nổ, chọn các vùng chèn, giữ kín vị trí giữa, kết thúc ván. Desktop còn kiểm tra kết nối lại và chơi lại.

Browser QA dùng Chromium/Playwright và Socket.IO server cục bộ; mobile là giả lập viewport/cảm ứng, chưa đo trên thiết bị thật. Các giá trị ping trong ảnh phản ánh môi trường cục bộ.

## Bổ sung thời gian và Nope

Thời gian dùng chung từ `packages/shared`: lượt thường 45 giây, Nope 12 giây, lựa chọn/cứu nổ 30 giây. Engine và vòng avatar dùng cùng thời lượng; vòng dựa trên deadline server đã hiệu chỉnh, không tự thay đổi khi chọn bài. Vòng không chạy chuyển động mượt khi bật giảm chuyển động. Popup tác dụng lá giữ 4,8 giây.

Nút Nope chỉ hiện nếu chính người xem có lá Nope. Thông báo “Ai Nope không?” và số giây chờ hiện công khai trên bàn, không tiết lộ ai đang giữ Nope. Nút Bỏ qua vẫn cho phép người chơi chủ động kết thúc chờ. Không tự bỏ qua cửa sổ chỉ vì tay bài không có Nope.

Browser QA bổ sung đã qua: đủ sáu viewport và bàn năm người, kiểm tra vòng ở avatar bản thân/đối thủ, tiến độ giảm theo deadline, và nút Nope theo tay bài riêng. Test desktop kiểm soát tay bài của cả hai người: không ai có Nope vẫn chờ đúng deadline 12 giây; có Nope thì nút hiện, chơi được và biến mất khi lá đã dùng. Hồi quy ghép bài, Favor, bàn phím, đồng hồ lệch và tự rút gần deadline đều qua. `nope-popup.png` ghi thông báo trên bàn cùng popup tác dụng lá.

## Bố trí lại bàn 5 người

Bốn đối thủ ngồi quanh bàn: hai người phía trên, hai người hai bên. Ghế xoay theo thứ tự chơi từ góc nhìn mỗi người; tên và avatar giữ cùng danh tính giữa các browser. Avatar SVG có hình mèo và bảng màu riêng, không tải ảnh ngoài. Bàn desktop giới hạn chiều rộng, bộ rút màu navy, giữ hai viền vàng. Avatar bản thân lớn hơn; tay bài mobile xòe theo số lá để nhìn được nhiều lá hơn. Lịch sử, trợ giúp và chat dùng nút biểu tượng. Chọn đối thủ làm sáng vòng quanh avatar, không mở thêm ô lựa chọn. Bộ chọn loại bài cho bộ ba nằm cùng hàng với nút hành động, tránh che ghế bên phải.

Kiểm chứng: 10 browser tests qua (bốn viewport bàn năm người, sáu viewport thao tác bàn). Bổ sung kiểm tra năm người tại 1366×768, 390×667, 844×390 và 547×287: các ghế không đè nhau, bấm được cả bốn đối thủ khi ghép đôi và bộ ba, đánh cặp, nhận thông báo và Bỏ qua Nope đồng bộ. Ba hồi quy chat/offline/kết nối lại, ghép bài/Favor/bàn phím và Hamster qua. 13 unit tests web, build và encoding qua. Engine không thay đổi trong lần bố trí này.

Các màn hình bàn chơi và đối thủ đã được kiểm chứng trực quan trên bốn viewport. Mobile vẫn là giả lập Chromium; chưa kiểm tra thiết bị thật hoặc triển khai production.

## Chạy lại browser QA

Chạy `npx tsx scripts/qa-server.ts` (server 3012, fixture loopback 3013). Chạy Vite với `VITE_SERVER_URL=http://localhost:3012` tại cổng 5182. Đặt `QA_BASE_URL=http://localhost:5182`, `QA_FIXTURES=1`, rồi chạy `npx playwright test --config scripts/playwright.config.ts table.e2e.spec.ts`.

Ảnh chụp kiểm tra tạm đã được dọn sạch trước khi commit để tối ưu dung lượng kho mã; `mobile-full-game.json` và `arena/regression.json` ghi lại kết quả ván cảm ứng và hồi quy kiểm thử.
