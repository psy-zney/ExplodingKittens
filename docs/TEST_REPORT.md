# Kết quả kiểm thử và triển khai

## Bổ sung khung chat — 2026-09-27

Đã deploy khung chat riêng trong lobby, bàn chơi và kết quả. Desktop có sidebar; mobile có nút nổi, số tin chưa đọc và dialog hỗ trợ bàn phím/focus. Có nickname, giờ gửi từ server, Enter/Shift+Enter, nhãn VI/EN, giới hạn 240 ký tự, giữ bản nháp khi thu gọn/chuyển màn/offline và không xóa trước khi nhận ack thành công. Server lưu riêng 100 tin gần nhất theo phòng, độc lập vòng 200 event, giữ qua start/rematch và reconnect. Nội dung người chơi được render như văn bản.

| Kiểm tra bản chat | Kết quả |
| --- | --- |
| Unit / integration | **72 PASS**: engine36 + Socket.IO26 + web10. Hai test server mới kiểm tra room isolation, xác thực sender, spectator, reconnect, chat không đổi game state và giữ history sau rollover event. |
| Typecheck / production build / UTF-8 | PASS. Build local và Docker trên VPS; kiểm tra UTF-8 cuối qua 87 file source/tài liệu. |
| UI production HTTPS | **4/4 PASS**, khoảng 1,4 phút. Hai scenario chat mới: VI/EN, HTML được escape, multiline, unread, bản nháp qua start, reconnect history, full game/rematch; mobile touch390×844, focus/Escape, thay viewport, offline draft và gửi sau reconnect. Hai scenario hồi quy: desktop2-browser + spectator, âm thanh/mute/privacy/guest refresh/winner/rematch và mobile chọn bài/chèn mọi khe/chơi trọn ván. |
| Socket.IO qua Nginx | **4/4 PASS**: HTTPS WebSocket, HTTPS polling, HTTP9000 WebSocket, HTTP9000 polling. Mỗi case có host, peer, spectator, một phòng độc lập, gửi Unicode, chặn giả mạo sender và khôi phục hai tin sau guest reconnect. |
| VPS | Docker healthy; compose config, Nginx `-t`, HTTP/asset/SPA/health và polling proxy PASS. Nginx9000 và backend127.0.0.1:3105. Kiểm tra không có kết nối backend trước khi thay container. |

Bằng chứng: [UI production](qa/chat-production/browser-results.json), [Playwright](qa/chat-production/playwright-report/index.html), [bốn transport](qa/chat-production/chat-transports.json). Ảnh: [chat lobby](qa/chat-production/screenshots/chat-lobby.png), [chat trên bàn](qa/chat-production/screenshots/chat-table.png), [chat mobile](qa/chat-production/screenshots/chat-mobile.png).

Release đã triển khai: image `e48a1cc636873d32bccca36ab2ce6ab0eff311f0b77f0177b81a58cee8859e9e`; JS `index-DWWWa_Dq.js`376,94kB, gzip118,38kB; CSS50,99kB. Source archive dùng cho build có SHA256 `F050F31EEDFF61E3E8CF189B8E85C36D1FECFC94440CD67DDBF3AA5CA18AA6DF`.

Đo rAF trong hai ván hồi quy trên Chromium153 headless/Windows10.0.26200/Core i5-12450HX/24GiB: desktop810 mẫu, median16,7ms, p9516,8ms, max33,4ms,98,77% dưới17ms; mobile giả lập931 mẫu, median16,7ms, p9516,8ms, max33,3ms,99,79% dưới17ms. Đây là khoảng cách callback trình duyệt, không phải chứng nhận FPS trên điện thoại thật.

Lượt chạy local đầu bị ảnh hưởng vì mô phỏng offline đóng cả WebSocket HMR của Vite, làm reload trang và mất state bản nháp. Runner đã sửa chỉ đóng socket game; local mobile PASS, rồi cả bốn UI case trên production PASS. Chat giữ bản nháp trong trang đang mở; reload toàn trang không lưu bản nháp. History chỉ giữ 100 tin và lưu RAM, mất khi restart server. Mobile kiểm tra bằng Chromium153 giả lập trên desktop, chưa thử điện thoại vật lý.

## Bản cập nhật minh họa và điều khiển — 2026-09-27

Đã thay hình đầu mèo đơn giản bằng **22 cảnh SVG theo chức năng**, giữ bốn style lazy load và màu nhóm bài. Composer có cách đánh riêng, target buttons, bảng gọi tên bài, tóm tắt trước xác nhận, hướng dẫn và gợi ý. Đồng hồ bù lệch giờ từ server, hiển thị fallback mỗi phase. Tự rút / tự chơi là hỗ trợ opt-in của ứng dụng; dừng khi chọn bài, tab ẩn hoặc offline, đặt lại Tắt mỗi ván.

| Kiểm tra bản cập nhật | Kết quả |
| --- | --- |
| Unit / integration | **70 PASS**: engine36, Socket.IO24, web10. Thêm shared play contract, selection, suggestion/autoplay mọi phase, clock skew, passed Nope reconnect. |
| Build / typecheck / encoding | PASS toàn workspace và Docker production. UTF-8 hợp lệ; `npm audit --omit=dev`:0 vulnerabilities. |
| UI có bài chuẩn bị trên server riêng | **3/3 PASS** trong14,6s: pair/triple/target keyboard/Favor, giữ nhóm khi chọn thêm lá cùng tên, tên bài bộ ba hiển thị trong cửa sổ Nope, Hamster từng lá và tiến độ, dừng auto khi chọn bài + tự rút sát deadline. Clock browser lệch +120s vẫn hiển thị đúng. Target chọn: chữ rgb(255,253,247) trên rgb(41,41,34), cao56,25px. Test fixture chỉ bind loopback, không có trong runtime production. |
| UI production HTTPS | **7/7 PASS** trong4,8 phút: full games2/3/4/5, VI/EN + style độc lập, chỉ tải style đang chọn, âm thanh/mute, reconnect/Nope, privacy Defuse, mobile touch, winner/rematch và ván tự chơi. Ba scenario cần fixture được bỏ qua có chủ đích trên production, chạy riêng ở hàng trên. |
| HTTP9000 UI | **1/1 PASS** trong31,8s: hai Chromium thật chơi trọn ván, guest refresh, hidden insertion, winner/rematch. |
| Forced transports | HTTPS WebSocket + polling và HTTP9000 WebSocket đều hoàn thành ván BASE2 người và EXTENDED3 người + Hồi Sinh, state đồng nhất, thắng và rematch. Scenario transport rút bài để kết thúc; các hiệu ứng mở rộng được kiểm tra trong engine. |
| Triển khai | Docker non-root healthy; Nginx `-t`, compose config, HTTP/assets/SPA fallback/health và Socket.IO proxy PASS. Nginx nghe9000, backend127.0.0.1:3105, public `/kittens/`; giữ ứng dụng khác ở route gốc. |
| Kiểm tra sau khi chốt release cuối | **2/2 PASS** trong47,5s: hai browser VI/EN/style/audio/privacy/guest refresh/full game/winner/rematch và card function/Nope reconnect. [Kết quả](qa/improvements-final-release/browser-results.json). Release source SHA256 `6BD6333380EB11B76CAF47648483363BCA6D54FC41ADC59C926AB6CBA7EBC51B`; image `cbd196352004a13a99fc696852306df5464439ff58e467d0b0a193ae3b6b50e8`; JS production `index-CmGcuH0H.js`370,64kB, gzip116,37kB. |

[Kết quả UI production](qa/improvements-production/browser-results.json), [Playwright](qa/improvements-production/playwright-report/index.html), [UI có bài chuẩn bị](qa/improvements-controlled/browser-results.json), [HTTP9000](qa/improvements-http9000/browser-results.json), [WebSocket HTTPS](qa/improvements-production/websocket-smoke.json), [polling HTTPS](qa/improvements-production/polling-smoke.json), [WebSocket9000](qa/improvements-http9000/websocket-smoke.json).

Ảnh: [bàn desktop](qa/improvements-production/screenshots/table-desktop.png), [mobile](qa/improvements-production/screenshots/table-mobile.png), [chọn người](qa/improvements-controlled/screenshots/composer-target-picker.png), [bộ ba](qa/improvements-controlled/screenshots/composer-triple.png), [chèn bài](qa/improvements-production/screenshots/insert-actor.png), [kết quả](qa/improvements-production/screenshots/results.png).

Đo bằng Chromium153 headless trên Windows10.0.26200, Core i5-12450HX,12 logical CPU,24GiB RAM; desktop1440×1000 và mobile emulated390×844, không throttle. Lấy khoảng cách callback `requestAnimationFrame` trong ván rút/chèn bài và ván tự chơi. Ván tự chơi production8292 mẫu: median16,7ms, p9516,8ms, max33,3ms,99,98% dưới17ms. Đây không phải phép đo GPU compositor hoặc điện thoại thật; chưa chứng nhận60FPS trên thiết bị mobile vật lý.

Các lỗi phát hiện ở lượt đầu đã sửa: vòng render của spectator do mảng rỗng tạo mới, text bị thay bằng `?` khi pipeline PowerShell chuyển encoding trong script chỉnh sửa, selector bộ mở rộng sai và timeout assertion ngắn hơn deadline của runner cũ. Bằng chứng PASS phía trên là các lượt chạy sau sửa. Nút chọn bài không gửi nhóm sai; server tiếp tục kiểm tra quyền sở hữu/phase/revision.

**Giới hạn còn lại:** ván và guest session lưu trong RAM một server; restart mất phòng đang chơi. Tự chơi là policy cơ bản, không đảm bảo thắng và không chạy trong tab ẩn. Mobile mới được đo bằng giả lập. Không triển khai rule combo4.

## Báo cáo baseline trước cải tiến điều khiển

Ngày chốt: **2026-09-27**. Code production chạy tại [game trên VPS](https://beatsync-server.zney295.id.vn/kittens/), HTTP trực tiếp tại [cổng9000](http://149.118.50.176:9000/kittens/). Đây là game realtime thật, không dùng dữ liệu giả cho ván chơi.

## Build và kiểm thử tự động

| Kiểm tra | Kết quả |
| --- | --- |
| Engine | **36/36 PASS**; chia bài2–5, Attack debt/Skip, Nope chains, cặp/ba, Future/Shuffle/Favor, Defuse mọi khe và privacy,8 lá mở rộng, Hồi Sinh và card invariants. |
| Mô phỏng trong engine | **96 ván hoàn chỉnh PASS**,6 seed ×4 số người ×2 bộ bài ×2 tùy chọn hồi sinh. Mỗi bước kiểm tra số lá vật lý/bomb balance, các lựa chọn bắt buộc dùng fallback server. |
| Socket.IO integration | **23/23 PASS**; session/host/lobby, readiness reset, origin check cả polling/WS, action đồng thời/lặp/cũ, late action/deadline, timers, spectator, reconnect, privacy,2–5 người thắng và rematch. |
| Web pure tests | **5/5 PASS**; event burst không mất hiệu ứng, hidden seq/gap, reconnect không replay, middle descriptor đồng nhất500ms, UUID fallback cho HTTP. |
| Tổng test unit/integration | **64/64 PASS**. |
| `npm run build` | PASS cả shared/engine/server/web. Vite production JS352.28kB, gzip109.81kB ở build local; CSS38.16kB, gzip8.94kB. Style SVG được chia thành chunk riêng. |
| `npm run typecheck` | PASS tất cả workspaces. |
| `npm run check:encoding` | PASS; UTF-8 hợp lệ, không ký tự thay thế hoặc mojibake ở source/tài liệu. |
| `npm audit` | **0 vulnerabilities** ở thời điểm kiểm tra. |

## Chromium thật trên production

`QA_BASE_URL=https://beatsync-server.zney295.id.vn/kittens/`,6 scenario PASS trong2 phút. [Dữ liệu đo và kết quả](qa/production/browser-results.json), [báo cáo Playwright](qa/production/playwright-report/index.html).

- Browser độc lập tạo/join/ready/start, full games2/3/4/5 đến đúng một người thắng; public state/revision nhất quán giữa máy.
- VI/EN và style riêng, đổi ngôn ngữ trong ván không đổi state; card có màu theo nhóm và SVG đã tải.
- Reconnect lượt thường, cửa sổ Nope, Defuse; guest giữ token/ghế. Spectator refresh giữ vai trò và không nhận bài bí mật.
- Middle insertion không có index/pointer/duration trong public payload/log/spectator/reconnect; TOP/BOTTOM có vùng hiển thị đúng. Actor chọn khe và xác nhận bằng UI thật.
- AudioContext chỉ tạo sau bấm Bật âm thanh; mute đưa gain về0 và được lưu. Không có lỗi console/runtime trong các kịch bản đạt.
- Mobile giả lập390×844 có touch; không tràn ngang trang, chọn lá/khe bằng tap, nút khe cao ít nhất44px; full game có thắng.
- Rematch trở về lobby rồi bắt đầu `gameId` mới.

HTTP trực tiếp `http://149.118.50.176:9000/kittens/`: scenario2 browser PASS35.1s, full game41 action, cả MIDDLE_HIDDEN/TOP/BOTTOM, reconnect và rematch. [Bằng chứng](qa/http9000/browser-results.json). UUID vẫn hợp lệ khi `crypto.randomUUID` không có trên origin HTTP.

## Reverse proxy và transport

VPS Ubuntu20.04, Nginx1.18, DockerNode24, một game-server container chạy non-root. Image production build thành công trên VPS; container **healthy**, restart policy `unless-stopped`. Backend bind **127.0.0.1:3105 →3001**; Nginx nghe **9000**. HTTPS qua route Cloudflare hiện có.

- `docker compose config --quiet`, `bash -n deploy/start-release.sh`, `nginx -t`: PASS.
- Local health3105, localhost9000 `/health` và `/kittens/health`, HTTPS health:200.
- Game HTML, JS asset, SPA fallback: đúng; asset không tồn tại:404. Index no-cache; asset hash immutable.
- Gateway-health của default vhost:200. Ứng dụng beatsync ở root HTTPS vẫn200.
- [Connection map](../deploy/nginx/kittens-upgrade.conf) ở http context; [Socket.IO proxy](../deploy/nginx/kittens-locations.conf) chuyển Upgrade, Connection có điều kiện, HTTP/1.1,75s timeout, bufferingoff.
- Forced WebSocket và forced HTTP polling trên HTTPS: mỗi transport chơi hết2-player BASE và3-player EXTENDED+Resurrection, snapshot nhất quán, có winner/rematch. [WS](qa/https-websocket-smoke.json), [polling](qa/https-polling-smoke.json).
- Forced WebSocket trực tiếp cổng9000 cũng chơi hết2 chế độ; [bằng chứng](qa/deployment-websocket-smoke.json).

Config cuối được backup tại `/var/backups/exxplore-kittens/20260927-034529`. Script [verify-release.sh](../deploy/verify-release.sh) đạt trên VPS sau cài config cuối.

## Đo frame

Máy thực: Intel i5-12450HX,12 logical CPU,24GiB RAM; Windows10.0.26200; Chromium153.0.8010.12 headless. Đo khoảng cách callback `requestAnimationFrame` trong full draw/Defuse/reconnect flow của production build, không bật trace và không throttle CPU.

| Luồng | Số mẫu | Median | P95 | Max | ≤17ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop1440×1000 trên VPS HTTPS |553|16.7ms|16.8ms|16.8ms|100%|
| Mobile390×844 giả lập cùng CPU |1282|16.7ms|16.7ms|16.8ms|100%|

Đây là khoảng cách callback, không phải số frame GPU đã trình bày. Chưa đo trên điện thoại tầm trung vật lý, Safari/Firefox hoặc compositor; **không tuyên bố đạt60FPS trên các thiết bị chưa thử**. Lần đo VPS cũ hơn có max66.7ms, nên các giá trị trên không phải bảo đảm mọi lần chạy đều giữ16.7ms.

## Ảnh chụp production

[Trang vào](qa/production/screenshots/entry.png) · [Lobby](qa/production/screenshots/lobby.png) · [Bàn desktop](qa/production/screenshots/table-desktop.png) · [Mobile](qa/production/screenshots/table-mobile.png) · [Chèn — actor](qa/production/screenshots/insert-actor.png) · [Chèn — observer](qa/production/screenshots/insert-observer.png) · [Kết quả](qa/production/screenshots/results.png).

## Giới hạn vận hành

- Phòng và guest token ở memory một process. Restart/deploy lại mất ván chưa xong; chưa có DB/Redis/multiple replicas. Cập nhật trong thời gian bảo trì; chưa atomic static release hoặc whole-release automatic rollback.
- Cấu hình/timing online,8 lá mở rộng và Hồi Sinh là luật ứng dụng công khai; combo chỉ2/3. Hồi Sinh thêm2 lá, mặc định tắt.
- Vercel chưa đăng nhập. Anonymous deployment đã thử build thành công nhưng chỉ sống1giờ và đã hết hạn. Bản VPS là link hiện tại; config Vercel và hướng dẫn CORS đã sẵn.
- Nhạc/SFX synth nguyên bản cơ bản; autoplay/mute được test, chất âm chưa nghe kiểm tra trên mọi loa/browser.
- Browser tests dùng Chromium headless thật với nhiều context độc lập, không phải các máy vật lý riêng. Chưa load-test số lượng lớn phòng công khai hoặc chứng nhận accessibility bằng người dùng screen reader.
- AGY review được thực hiện qua stdin không dùng tool, sau khi headless permission auto-denied. [Kết quả đã đối chiếu](qa/AGY_REVIEW.md); [bàn giao tiếp tục](../AGY_HANDOFF.md).
