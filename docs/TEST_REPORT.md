# Sửa cấu hình Vercel — 2026-09-27

Log người dùng báo TS2307/TS2875: module React/React DOM/plugin React và type chưa được resolve. Dependency đã khai báo trong apps/web/package.json và lockfile. Chưa có install log của deployment để xác định chính xác workspace/omit override trên Vercel.

vercel.json đổi installCommand thành npm ci --workspaces --include-workspace-root --include=dev. Giữ build shared -> web, output apps/web/dist, Root Directory ở gốc repo. Thêm deploy/VERCEL.md và deploy/vercel.env.example với ba VITE ENV trỏ HTTPS VPS / Socket.IO path /kittens/socket.io / web base /.

Kiểm tra trên checkout sạch trong thư mục Temp, không dùng node_modules hiện có của workspace chính: Node24.18.0, npm11.16.0, Windows. Install chỉ workspace shared + root: shared build PASS, web fail thiếu vite/client. Đây là mô phỏng install thiếu package web, không phải khẳng định đúng install command của deployment Vercel.

Cài lại bằng command mới, với NODE_ENV=production và NPM_CONFIG_OMIT=dev: npm ci PASS (220 packages, audit 0 vulnerabilities); build shared và tsc -b + vite build của web PASS. ENV VITE_SERVER_URL=https://beatsync-server.zney295.id.vn, VITE_SOCKET_PATH=/kittens/socket.io, VITE_BASE_PATH=/. 107 modules, JS index-Ci4ybXM8.js, web dist có base /. Kiểm tra UTF-8 PASS. Không đổi engine/server/component để che lỗi type. Artifact: docs/qa/vercel-clean-build.json.

Chưa xác nhận deployment Ready trên tài khoản Vercel; chưa có domain production để thêm exact Origin vào VPS. Hướng dẫn nêu rõ phần CORS và maintenance cần thiết khi recreate backend để áp dụng ENV.
# Release chọn Cứu Nổ 5 giây và hiệu ứng — 2026-09-27

**Production:** https://beatsync-server.zney295.id.vn/kittens/ · HTTP trực tiếp http://149.118.50.176:9000/kittens/.

## Chốt repository và kiểm tra script phát hành

Ngày 2026-09-27: chạy lại 84 test, typecheck, build production và kiểm tra UTF-8: PASS. Đối chiếu App.tsx, useAudio.ts, playfulGame.css và server.ts trên VPS khớp nguồn local trước phát hành. Bổ sung guard kết nối trước thay backend, cập nhật web sao chép cả public media trước index, và verify-release kiểm tra hash từng GIF/MP3 để tránh SPA fallback trả HTML thay âm thanh. Hai operational test guard (kết nối đang mở / build lỗi) PASS bằng shell stub không chạy lệnh Docker thật. nginx -t, Compose, shell syntax, health/SPA/polling và hash đủ 13 public media PASS trên VPS. QA và bản sao tạm nằm ngoài Docker context. Gói deploy được tạo bằng git archive từ commit đã push, giữ .env hiện có trên VPS.

Production audit dựa trên nguồn/tests/runtime: 82/100, chạy được cho một VPS với giới hạn RAM qua restart và chưa đo điện thoại vật lý. Không phát hiện blocker trong các luồng đã kiểm tra; chưa có bằng chứng CI độc lập. UI có backup index và giữ asset cũ; backend cần maintenance vì rollback image không khôi phục ván RAM. Kết quả browser-results và screenshots được lưu trong Git; báo cáo HTML Playwright là artifact local được ignore.
## Phạm vi hoàn tất

Mở ván DEALING: sáu Cứu Nổ biểu cảm riêng, chọn trong đủ 5000 ms, khóa first accepted pick, fallback RNG cho người chưa chọn, sau đó mới chia thêm bảy lá. Spectator không chọn, refresh giữ ghế/lựa chọn/deadline, server từ chối chọn trùng/đổi lựa chọn/ID giả/chọn muộn. Bộ cơ bản có sáu Defuse và bốn Boom có metadata biểu cảm ổn định, không đổi tác dụng.

Thanh ném trứng/bom đồ chơi/đá nhỏ chọn người nhận, event đồng bộ phòng, cooldown 1500 ms/session và retry không nhân đôi; không đổi engine/revision/deadline. Sticker/SFX theo chức năng, phản hồi nút/chọn bài, burst nổ/Defuse, gray/K.O. và deal/win. Effect queue ở room shell nên nổ/loại/thắng cuối ván không mất khi results xuất hiện. Có Mute/reduced motion và chữ báo; public insertion chỉ TOP/BOTTOM/MIDDLE_HIDDEN. Thông báo vùng chèn giữ đến hành động tiếp theo; animation giữa vẫn cùng 500 ms và không dùng vị trí riêng.

## Kết quả

| Gate | Kết quả thực tế |
| --- | --- |
| npm test | **84 PASS**: engine42, server30, web12. Engine có 96 ván mô phỏng 2–5 người, cả hai bộ bài và hồi sinh; test chọn đúng lá, bảo toàn lá/biểu cảm, race/retry/deadline/reconnect/spectator và đồ chơi không đổi game. |
| Typecheck / build / UTF-8 | PASS toàn workspace. Docker Node24 production build PASS trên VPS. |
| UI local | **14 tình huống đã PASS qua các lượt chạy**. Lượt đầy đủ đầu:13/14; một case5 người bỏ lỡ overlay500 ms. Bổ sung thông báo vùng chèn giữ đến hành động kế tiếp, chạy lại4 case gồm5 người:4/4 PASS. Bản UI cuối kiểm tra kho bài và draft/đồ chơi/K.O.:2/2 PASS. Có composer/combo2/3/target/Favor/Nope reconnect/Hamster/autodraw/manual-cancel/full autoplay/rematch. |
| UI production cuối | **7/7 PASS** trong3,8 phút, Chromium thật153.0.8010.12: kho22 loại/bốn nét; draft mobile3 browser VI/EN, keyboard/touch/reload/fallback/ba đồ chơi; chat VI/EN/unread/escaping/reconnect/fullgame/rematch; chat mobile/focus/offline draft;2 guest+bilingual/audio/Mute/private insert/spectator/reconnect/win/rematch;5 guest hết ván; mobile touch chọn bài/tất cả khe chèn/hết ván. Không có console/page error trong các case. |
| HTTPS WebSocket | BASE2 và EXTENDED3+hồi sinh: hết ván, snapshot nhất quán, một người thắng, rematch PASS. Transport cưỡng bức websocket, không dùng polling để che lỗi. |
| HTTP9000 polling | BASE2 và EXTENDED3+hồi sinh: hết ván/sync/win/rematch PASS. Transport cưỡng bức polling, không nâng cấp WS. |
| Nginx / Docker | nginx -t; shell syntax; Compose config; health/static/SPA/Engine.IO polling; listen9000 và loopback3105 PASS. |

Một lần test production gặp thứ tự xáo hợp lệ với Kitten ở cuối bộ rút, không có khe giữa khả dụng; assertion cũ yêu cầu MIDDLE_HIDDEN vô điều kiện nên fail. Test đã sửa: hoàn thành ván thật rồi rematch khi cần để kiểm tra một lần chèn giữa hợp lệ, không xem/ép thứ tự bộ rút. Lượt production cuối7/7 PASS sau sửa.

## Số đo frame time và giới hạn

Windows11 10.0.26200, Intel i5-12450HX,12 logical CPUs,24GiB RAM; Chromium153 headless. Desktop1440×1000; mobile390×844 cảm ứng giả lập, cùng CPU desktop. Đo khoảng cách callback requestAnimationFrame từ các thao tác ném đồ/rút/chèn bài đến hết ván, gồm các bước chụp ảnh/reconnect. Không phải đo GPU compositor và chưa chạy điện thoại vật lý.

| Kịch bản trên URL production cuối | Mẫu | Median | p95 | ≤16,7 ms | ≤17 ms | Max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Draft/đồ chơi/3 browser mobile/hết ván |1786|16,7ms|16,8ms|65,34%|99,33%|1333,3ms|
|2 browser desktop/hết ván|1379|16,7ms|16,8ms|68,67%|96,23%|100ms|
|Mobile touch/hết ván|777|16,7ms|16,8ms|54,70%|97,81%|50ms|

Có outlier; các số trên không bảo đảm60FPS ổn định hoặc chứng minh hiệu năng điện thoại tầm trung. Luật/timer/reconnect vẫn do server quyết định khi animation tắt. Server hiện một process, RAM: giữ reconnect120s nhưng restart mất ván/session; phòng tối đa5 người.

## Artifact và release

- docs/qa/playful-final-production/browser-results.json, playwright-report và screenshots: bản UI production cuối7/7.
- docs/qa/playful-final-production/deployment-websocket-smoke.json và deployment-polling-smoke.json: bốn ván transport thật.
- docs/qa/playful-local và playful-verify: toàn bộ14 case/local rerun; playful-final-local:2 case của UI cuối.
- docs/qa/playful-motion-artifacts: ảnh lấy từ ván production thật; khi chụp nổ/K.O. chỉ tạm giữ frame CSS đang phát, server/state/queue vẫn chạy.
- Backend image: abd732e263bf631ee057b9e196e64b8bfb07576196902a997b5ee8f264f78886, healthy, started2026-09-27T10:36:47.882672264Z. Kích hoạt khi số kết nối3105 bằng0; script mới build trước và chặn restart nếu còn kết nối.
- UI image:8d10c3424a9ce0c04a21bbc91bc8b8809c300dd6aefefc8698f5f308a1689d31; frontend-only publish sau đó giữ nguyên backend và thời điểm chạy.
- JS index-C8DA8-y7.js:486,05kB/gzip147,50kB, SHA256 c327597bccc4619e69c17d5a0c35624decd92a71353d435418f39ece6c22d406. CSS index-D0u15B9Y.css101,31kB/gzip22,12kB.
- Nginx vẫn phục vụ beatsync hiện có, /kittens/ tại gateway9000; giữ .env trên VPS. Header/preload/audio dùng BASE_URL, không gọi nhầm asset ở root.

# Kết quả kiểm thử và triển khai

## Một bộ bài phối bốn nét vẽ — 2026-09-27

Yêu cầu mới nhất thay lựa chọn style riêng bằng **cả bốn nét vẽ trong một bộ bài chung**. `cardPresentation.ts` gán nét cố định cho từng CardType; CardView dùng cùng minh họa ở mọi trình duyệt, bất kể cài đặt style cũ. Không còn bộ chọn style ở entry, settings hoặc kho bài. Bài trên tay, bộ bỏ, khay xem riêng và hoạt ảnh đều dùng mapping chung. 22 loại lá có cảnh SVG gốc, mèo tô màu/tư thế/biểu cảm, đạo cụ và mảng màu. Bàn và mặt sau dùng giấy hồng ấm, đỏ gạch; Cứu Nổ xanh, nổ đỏ, chức năng/họ combo có màu riêng. Kho bài có bộ lọc, hướng dẫn VI/EN đúng combo 2/3; mobile cuộn một cột và hiển thị trọn lá xem trước.

| Kiểm tra bản phối nét | Kết quả |
| --- | --- |
| Unit / integration | **72 PASS**: engine36 + Socket.IO26 + web10. Luật và giao thức server giữ nguyên trong lượt cập nhật mỹ thuật này. |
| Build / typecheck / UTF-8 | PASS toàn workspace; Docker production build trên VPS PASS. Web local và Docker tạo cùng JS SHA256. |
| UI local | **3/3 PASS**: kho 22 loại/bốn nét, hai browser VI/EN chơi hết ván, mobile touch. Sau sửa kích thước/cuộn kho bài, case kho desktop/mobile PASS lại. |
| UI production HTTPS | **5/5 PASS** trong khoảng 1,4 phút: kho bài desktop/mobile đủ bốn nét và không có selector; chat VI/EN/escaping/unread/reconnect/full game/rematch; chat mobile/focus/offline draft; hai browser có preference style cũ khác nhau vẫn thấy Defuse cùng SVG, âm thanh chỉ mở sau tương tác/Mute, spectator/privacy/guest refresh/winner/rematch; mobile touch chọn bài/chèn khe và hoàn thành ván. |
| Socket.IO forced transport | **2/2 PASS**: HTTPS WebSocket và HTTP9000 polling. Mỗi transport hoàn thành BASE2 người và EXTENDED3 người + Hồi Sinh, public snapshots đồng nhất, có người thắng và rematch. Kịch bản transport dùng rút/chèn để kết thúc ván; hiệu ứng mở rộng có unit test riêng. |
| Publish và Nginx | PASS compose config, `bash -n`, Nginx `-t`, HTTP/static asset/SPA fallback/404/health/polling proxy. Script `publish-web.sh` lấy web từ container tạm không chạy, giữ asset cũ, backup index và thay index cuối cùng. Backend container và thời điểm khởi động không đổi: `2026-09-27T08:03:12.257666527Z`. |

Bằng chứng: [UI production](qa/mixed-art-production/browser-results.json), [Playwright](qa/mixed-art-production/playwright-report/index.html), [WebSocket HTTPS](qa/mixed-art-production/websocket-https.json), [polling HTTP9000](qa/mixed-art-production/polling-http9000.json), [release metadata](qa/mixed-art-production/release.json). Ảnh thật: [kho bài desktop](qa/mixed-art-production/screenshots/mixed-codex-desktop.png), [kho mobile](qa/mixed-art-production/screenshots/mixed-codex-mobile.png), [bàn desktop](qa/mixed-art-production/screenshots/table-desktop.png), [bàn mobile](qa/mixed-art-production/screenshots/table-mobile.png), [chat](qa/mixed-art-production/screenshots/chat-table.png).

UI production: JS `index-C-Kb0D2G.js`403,55kB, gzip125,81kB; CSS `index-BAPSF61f.css`84,54kB, gzip18,24kB; shared artwork chunk12,28kB, gzip4,30kB. JS SHA256 `9086188C88EF70F0A6D756043082F9A8BF59A152AA5C59BC4B175C39CD88F16B`; source archive build SHA256 `6A6E83E5E6945D1BC07BE0B5C3C53F786770291CA7E5161CD109F644E1B36AE8`. Image chứa web mới và runtime sẵn cho lần bảo trì sau: `370f47351d02c4b7ac905096ba6ea9cf93f7164bbef6b223dc0d3a1892b0f1e5`. Backend đang chạy image tương thích của bản chat `e48a1cc636873d32bccca36ab2ce6ab0eff311f0b77f0177b81a58cee8859e9e`; không thay process đang giữ các phòng.

Đo rAF khi rút/chèn bài trong ván thật trên Chromium153.0.8010.12 headless, Windows10.0.26200, Core i5-12450HX/12 logical CPU/24GiB. Desktop1440×1000:604 mẫu, median16,7ms, p9516,7ms, max100ms;68,05% trong16,7ms và98,51% dưới17ms. Mobile touch giả lập390×844 trên cùng CPU, không throttle:638 mẫu, median16,7ms, p9516,7ms, max16,8ms;70,85% trong16,7ms và100% dưới17ms. Local dev có HMR/compile và frame gián đoạn lớn hơn; số production phía trên đo riêng. Đây là khoảng cách callback rAF, chưa đo compositor GPU hoặc điện thoại vật lý, không chứng nhận60FPS trên mobile thật.

Ngôn ngữ, âm lượng và reduced motion tiếp tục là cài đặt riêng. Nhạc/SFX tổng hợp nguyên bản và nút Mute nhanh trong header được giữ từ cập nhật đồng thời trong workspace; browser test kiểm tra gate/Mute, chưa đánh giá nghe trên mọi thiết bị. Rooms/history vẫn lưu RAM và mất khi restart backend. Các mục bên dưới là kết quả của các release trước, gồm hành vi chọn style cũ đã được thay thế trong bản này.

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
