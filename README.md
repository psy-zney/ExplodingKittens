# Exxplore Kittens / Mèo Nổ online

Game bài nhiều người chơi theo thời gian thực, 2–5 người mỗi phòng, không cần tài khoản. Mỗi trình duyệt tự chọn Tiếng Việt/English, một trong bốn nét mèo gốc, âm lượng và mức chuyển động. Mã phòng và liên kết mời đưa bạn bè vào cùng một ván.

**Chơi ngay:** [Game production trên VPS](https://beatsync-server.zney295.id.vn/kittens/). Nginx trên `vps-cong` phục vụ tại `http://localhost:9000/kittens/`; HTTP trực tiếp tại [cổng 9000](http://149.118.50.176:9000/kittens/). Backend chỉ bind `127.0.0.1:3105`, qua proxy `/kittens/socket.io/`. Ván 2–5 người đã được kiểm tra bằng nhiều Chromium thật trên URL production.

Các nét bút bi, giấy đóng dấu, pixel và hình học là SVG/CSS nguyên bản. Không dùng artwork, âm thanh hoặc hình minh họa thương mại. Bộ 56 lá và lượt cơ bản tham khảo [hướng dẫn Original Edition](https://www.explodingkittens.com/pages/rules-kittens) và [field guide chính thức](https://www.explodingkittens.com/pages/comprehensive-field-guide). Tám lá thêm và Hồi Sinh là **quy tắc mở rộng của ứng dụng**, được ghi cụ thể trong [rule contract](docs/RULE_CONTRACT.md) và bảng luật ở lobby; không được trình bày như luật gốc.

## Chạy trên máy

Yêu cầu Node.js 22+ và npm 11+.

```sh
npm ci
npm run dev
```

Mở `http://localhost:5173`. Server ở `http://localhost:3001`; `GET /health` dùng để kiểm tra sức khỏe. Mở hai cửa sổ trình duyệt, nhập hai nickname, tạo phòng ở cửa sổ đầu và vào bằng mã hoặc link ở cửa sổ sau. Mọi người bấm Sẵn sàng; chủ phòng bắt đầu. Đánh các lá hợp lệ, hoặc rút để kết thúc lượt. Người sống cuối cùng thắng; chủ phòng chọn chơi lại để tạo ván mới.

Tạo `apps/web/.env.local` khi web và server ở hai origin:

```dotenv
VITE_SERVER_URL=http://localhost:3001
VITE_SOCKET_PATH=/socket.io
```

Server nhận `PORT`, `CORS_ORIGIN` (danh sách origin phân tách bằng dấu phẩy) và `SOCKET_PATH`. Xem [.env.example](.env.example).

## Kiểm tra

```sh
npm run test
npm run typecheck
npm run build
npm run check:encoding
npm audit --omit=dev
```

Engine có test chia bài, bảo toàn lá, Attack/Skip/Nope, mọi khe Defuse, combo, tám lá mở rộng và Hồi Sinh. Server có test Socket.IO thật cho 2–5 người, ván đến người thắng và rematch, reconnect, hành động đồng thời/lặp/cũ, spectator và quyền riêng tư chèn bài. Kết quả chạy và giới hạn đo trình duyệt nằm ở [báo cáo kiểm thử](docs/TEST_REPORT.md).

Kiểm thử production bằng UI và hai transport riêng:

```powershell
$env:QA_BASE_URL='https://beatsync-server.zney295.id.vn/kittens/'
$env:QA_ARTIFACT_DIR='docs/qa/production'
npm run test:e2e
node scripts/deployment-smoke.mjs
$env:SMOKE_TRANSPORT='polling'
node scripts/deployment-smoke.mjs
```

## Trò chuyện trong phòng

Khung chat riêng có trong lobby, bàn chơi và màn kết quả. Desktop hiển thị bên cạnh bàn; mobile có nút **Trò chuyện** kèm số tin chưa đọc. Gửi bằng Enter hoặc nút Gửi; Shift+Enter xuống dòng. Mỗi tin tối đa 240 ký tự, hiển thị người gửi và giờ gửi. Nhãn VI/EN đổi theo từng trình duyệt; nội dung người chơi giữ nguyên.

Server giữ 100 tin gần nhất của từng phòng, độc lập nhật ký hành động, để phục hồi sau reconnect và giữ khi chơi lại. Người xem và người bị loại vẫn có thể chat. Chỉ thành viên của phòng nhận tin; danh tính người gửi lấy từ guest session. Nội dung được render như văn bản, có validation và rate limit. Bản nháp không mất khi thu gọn, chuyển màn, gửi thất bại hoặc mất kết nối trong trang đang mở. Phòng, lịch sử và session hiện lưu trong RAM, nên restart server sẽ mất chúng.

## Điều khiển và hỗ trợ người mới

- Chọn cách đánh **lá chức năng / cặp / bộ ba / ++**, sau đó chọn lá. Lá đơn thay thế lựa chọn cũ; nhóm ghép chỉ nhận cùng tên, ++ chỉ đi với lá có giá trị số. Nút chọn người hiện tên, số bài và dấu xác nhận. Bộ ba có bảng gọi tên bài riêng. Xem lại tóm tắt rồi bấm Đánh bài.
- Viền chấm đánh dấu lá chọn được trong cách đánh hiện tại. Viền xanh và nhãn **Gợi ý** đề xuất xem tương lai, tránh mèo nổ đã được xem hoặc ghép bài mèo. Gợi ý chỉ dùng snapshot của người chơi, không biết bộ rút thật hay bài đối thủ; không bảo đảm thắng.
- Các bước Xin bài, Dơi và Hamster chỉ chọn đúng một lá mỗi lần. Hamster hiển thị số lá còn phải bỏ. Hướng dẫn nhanh có ngay trên bàn, dịch VI/EN độc lập.
- Đồng hồ và thanh thời gian dùng `serverNow` để bù lệch giờ trình duyệt. Mỗi phase ghi rõ người cần trả lời và fallback khi hết giờ. Trạng thái đã bỏ qua Nope giữ được sau reconnect.
- **Tự chơi tắt mặc định mỗi ván**: tự rút khi còn 5 giây hoặc tự chơi cơ bản. Cơ bản ưu tiên xem tương lai, tránh nổ đã biết, ghép bài mèo; giữ Cứu nổ, bỏ qua Nope, chọn bài ít giá trị cho quyết định bắt buộc, chèn xuống đáy và chọn Búa. Mỗi lượt tối đa ba hành động đánh trước khi rút. Bấm một lá để dừng. Tự chơi chỉ chạy ở tab đang hiện và kết nối; mọi ý định vẫn phải qua validation của server. Chơi lại đặt về Tắt. Đây là tính năng hỗ trợ của ứng dụng.
- 22 loại bài có cảnh SVG riêng và màu chức năng; bốn style dùng cùng vị trí thông tin và chỉ tải module style được chọn.

### Kiểm tra thao tác có bài được chuẩn bị

Runner riêng chỉ dùng trên máy kiểm thử. `scripts/qa-server.ts` không được import hoặc đưa vào Docker runtime; cổng chuẩn bị bài 3013 chỉ bind loopback. Browser chơi qua Socket.IO thật và các chuyển trạng thái của engine.

```powershell
# Terminal 1
npx tsx scripts/qa-server.ts
# Terminal 2
$env:VITE_SERVER_URL='http://localhost:3012'
npm run dev -w @kittens/web -- --port 5182
# Terminal 3
$env:QA_BASE_URL='http://localhost:5182'
$env:QA_FIXTURES='1'
$env:QA_ARTIFACT_DIR='docs/qa/improvements-final-local'
npm run test:e2e
```

Không bật `QA_FIXTURES` khi kiểm tra URL production. Ba kiểm tra cần chuẩn bị bài sẽ tự bỏ qua ở production; các kiểm tra full game và tự chơi vẫn chạy.

## Bộ bài trong phòng

| Chế độ | Số lá trước khi chia | Thêm vào |
| --- | ---: | --- |
| Cơ bản (mặc định) | 56 | Luật lượt cơ bản, cặp/ba lá, Nope. |
| Mở rộng | 64 | Amateur Archaeology, Battle Hamster, Creepy Peeky, Hip Bat, Hip Cat, Plus Plus, Robin Hood, The Twins; mỗi loại một lá. |
| Hồi Sinh tùy chọn (mặc định tắt) | +2 | Hai lá Hồi Sinh do ứng dụng thiết kế, không nằm trong bộ 56/64. |

Mỗi ván bắt đầu với một Defuse và bảy lá khác cho mỗi người; số lá Mèo Nổ trong bộ rút bằng số người chơi trừ một. Sau Defuse, người chèn tự chọn khe 0..N; những người khác chỉ biết `TOP`, `BOTTOM` hoặc `MIDDLE_HIDDEN`. Các quyết định hết giờ do server giải quyết. Bảng đầy đủ, gồm trường hợp thiếu bài, mất kết nối và quyền xem, nằm ở [docs/RULE_CONTRACT.md](docs/RULE_CONTRACT.md).

## Kiến trúc

Monorepo npm workspaces:

- `packages/shared`: mã lá ổn định, schema Zod, type event/snapshot.
- `packages/engine`: state machine TypeScript thuần, RNG phía server, bất biến bảo toàn lá.
- `apps/server`: Express + Socket.IO, guest session, room queue, timer, lọc thông tin theo người xem.
- `apps/web`: Vite + React, responsive UI, dịch trên client, SVG/CSS, Web Audio và hoạt ảnh.

Sơ đồ state machine, mô tả socket/event và ranh giới quyền xem ở [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Intent game gồm `gameId`, `turnId`, `actionId`, `expectedRevision`; server kiểm tra lại trước mỗi thay đổi. Event có `seq`/`revision`; reconnect lấy snapshot đã lọc. Client không tải thứ tự bộ rút hoặc tay bài người khác.

## Triển khai

VPS đã có bản production, Docker healthcheck và Nginx9000 cho HTTP/WebSocket. Hướng dẫn cấu hình, backup, cập nhật và kiểm tra đầy đủ trong [deploy/README.md](deploy/README.md). Trên VPS:

```sh
cd /home/ubuntu/exxplore-kittens
bash deploy/start-release.sh
bash deploy/verify-release.sh
```

Triển khai lại là thao tác bảo trì: container mới thay process và kết thúc các ván trong memory. File cấu hình Nginx được backup rồi kiểm tra trước reload. Không có cam kết triển khai không gián đoạn hoặc phục hồi ván qua restart.

Backend một instance trên VPS:

```sh
cp .env.example .env
# Điền CORS_ORIGIN bằng origin HTTPS của web.
docker compose up -d --build
```

[compose.yaml](compose.yaml) chỉ mở backend trên loopback `127.0.0.1:3105`. Reverse proxy cần chuyển WebSocket upgrade và path Socket.IO; đặt `VITE_SERVER_URL` và `VITE_SOCKET_PATH` tương ứng ở web build. Web có thể build `npm run build -w @kittens/web` rồi phục vụ `apps/web/dist` bằng static host, hoặc triển khai Vite app lên Vercel. Trang HTTPS cần backend HTTPS/WSS.

Hiện trạng lưu phòng và guest token trong bộ nhớ của **một** server. Khởi động lại process sẽ mất ván đang chơi. Để chạy nhiều replica hay giữ ván qua restart, phải thêm kho state bền vững, hàng đợi/khóa theo phòng và adapter Socket.IO; chỉ thêm adapter không đủ. Không lưu nickname hay tay bài vào log server. URL triển khai thực tế và kết quả kiểm thử đã ghi trong [docs/TEST_REPORT.md](docs/TEST_REPORT.md).

Vercel có config [vercel.json](vercel.json), nhưng chưa đăng nhập tài khoản. Bản anonymous đã thử chỉ tồn tại một giờ và đã hết hạn; link VPS ở đầu README là bản chạy hiện tại. [AGY_HANDOFF.md](AGY_HANDOFF.md) ghi đủ trạng thái để tiếp tục công việc; [scripts/continue-agy.ps1](scripts/continue-agy.ps1) mở AGY với quyền thông thường.
