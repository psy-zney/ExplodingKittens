## Chọn Cứu Nổ 5 giây và hiệu ứng — đang kiểm tra release

Contract đầu RULE_CONTRACT/ARCHITECTURE: DEALING trước PLAYING, sáu Defuse biểu cảm riêng, first accepted pick, đủ 5000 ms, fallback RNG, createGame.defuseChoices giữ lá rồi chia bảy. Socket thêm room:choose-defuse/room:throw. Release này đổi backend, phải full deploy.

84 unit/integration PASS (engine42 gồm 96 ván mô phỏng, server30, web12); đang chạy 14 e2e local. Test mới “five-second rescue draft” kiểm tra mobile ba browser VI/EN, keyboard/touch, draft reconnect/fallback, ba đồ chơi, revision/deadline không đổi, nổ/K.O. qua results. Bilingual Defuse cùng nét nhưng khác biểu cảm vật lý.

Dùng native UTF-8 writes nếu editor patch làm mất sửa khác; kiểm tra server DEALING/handlers và App SocialEffects/InteractionFeedback. Không chạm resume_codex scripts/key secrets. Chạy test/typecheck/build/check:encoding rồi QA. Full deploy lúc không có kết nối backend, giữ .env/Nginx beatsync. Không tuyên bố điện thoại thật 60 FPS hoặc phòng >5 người.

# AGY — tiếp tục Exxplore Kittens

Updated 2026-09-27. Workspace: `C:/Users/admin/MyProject/ExxploreKittens`.

## Mục tiêu và phạm vi

Hoàn thiện và vận hành game Mèo Nổ online thật: tạo phòng, VI/EN riêng từng browser, 2–5 ghế, 56/64 lá, Hồi Sinh tùy chọn, thắng và rematch. Yêu cầu mỹ thuật mới nhất: cả bốn nét vẽ phối chung trong một bộ bài, bỏ chọn style riêng; minh họa màu sắc phong phú, nền hơi đỏ. Các range dính chữ trong brief đã được đọc là 2–5 người, 16–32px, 45–75s, 180–550ms, thêm 2 lá Hồi Sinh. Không có rule combo 4; có màu riêng từng họ Cat Card, combo 2/3. Tám lá mở rộng và Hồi Sinh là luật ứng dụng, contract trong lobby và `docs/RULE_CONTRACT.md`.

## Đã hoàn tất và xác minh

### Yêu cầu mới: phối bốn nét vẽ trong cùng bộ bài — đã deploy

- Người dùng đã bỏ yêu cầu mỗi browser chọn một style: **mọi nét vẽ cùng xuất hiện trong một bộ bài**, màu sắc phong phú hơn, nền hơi đỏ. Không khôi phục StylePicker ở entry/settings/kho bài hoặc `style` prop cho CardView. `kittens.style` cũ chỉ bị bỏ qua; ngôn ngữ/audio/motion vẫn riêng từng người.
- `cardPresentation.ts` ánh xạ CardType→ArtStyle cố định. CardView, Table/private insight, GameEffects, entry preview, results và CardCodex cùng dùng mapping. `CatActor.tsx` + `CardScene.tsx` có mèo tô màu/biểu cảm/tư thế/đạo cụ/cảnh; `IllustratedDeck.css` là override cuối cùng, giấy hồng ấm/đỏ gạch. Minh họa SVG gốc, không sao chép artwork thương mại. Kho đúng22 loại/base13, bộ lọc, card gallery, luật VI/EN; mobile một vùng cuộn, preview trọn lá.
- Cập nhật âm thanh và kho bài từ phiên khác đã được giữ; đã sửa các prop style cũ bị thêm lại, luật combo5 chưa triển khai bị ghi nhầm trong kho, Defuse dư tối đa2 và hướng dẫn Attack thường2/inherited debt+2. Không sửa engine/server/schema.
- **72 unit/integration PASS**, typecheck/build/UTF-8 PASS; Docker production build PASS. **5/5 UI production PASS**: mixed deck desktop/mobile, chat desktop/mobile, full game2-browser VI/EN + audio/privacy/reconnect/winner/rematch, mobile full game. **2/2 forced transport PASS**: HTTPS WS và HTTP9000 polling, mỗi transport có ván BASE2 và EXTENDED3 + Hồi Sinh đến winner/rematch. `docs/qa/mixed-art-production` và phần đầu `docs/TEST_REPORT.md` là bằng chứng mới nhất.
- Web mới `index-C-Kb0D2G.js`; image đã build `370f47351d02c4b7ac905096ba6ea9cf93f7164bbef6b223dc0d3a1892b0f1e5`. Đã publish web bằng `deploy/publish-web.sh`, **không restart backend**. Backend vẫn dùng image chat `e48a1cc636873d32bccca36ab2ce6ab0eff311f0b77f0177b81a58cee8859e9e`, started08:03:12UTC không đổi. Image tag mới sẵn cho lần bảo trì tiếp theo; đừng gọi đó là image backend đang chạy.
- `publish-web.sh` chỉ dùng khi web tương thích protocol hiện tại: build image, tạo container tạm không chạy, copy static/giữ hashed assets cũ/backup index/publish index cuối, kiểm tra backend ID/starttime không đổi rồi verify Nginx. Nếu đổi server/schema phải dùng maintenance release có kiểm tra phòng đang chơi. Không restart chỉ để cập nhật docs.
- Báo cáo frame hiện tại là rAF trên Chromium headless i5-12450HX, mobile giả lập; không khẳng định đã đo điện thoại thật. Các kết quả style chọn riêng phía dưới thuộc release trước.

### Bổ sung khung chat đã deploy

- Yêu cầu mới nhất: **THÊM KHUNG CHAT**. Đã tạo `apps/web/src/RoomSidebar.tsx`, `RoomChat.css`, sidebar desktop và nút mobile/unread/dialog. Chat có trong lobby, bàn chơi, kết quả; giữ state qua start/rematch, giữ draft khi thu gọn hoặc offline, đợi ack mới xóa. Nhãn VI/EN, sender/time, 240 ký tự, Enter/Shift+Enter, focus trap/Escape/restoration và text escaping.
- Server có `room.chatMessages` ring100 độc lập event200, snapshot thêm `chatMessages`; `chat.message` thêm `sentAt`. Giữ history qua start/rematch/reconnect, chỉ gửi thành viên/phòng đúng, watcher và người bị loại có thể chat. Chat không thay state engine. Schema/rate limit/session authority giữ nguyên.
- **72 unit/integration PASS = engine36 + server26 + web10**, typecheck/build/UTF-8 PASS. **4/4 UI production PASS**: chat desktop, chat mobile/offline/viewport/focus, baseline full game2 + spectator/audio/privacy/reconnect/rematch, mobile full game/chọn bài/chèn khe. **4/4 transport chat PASS**: HTTPS/HTTP9000 × WebSocket/polling, sender authority/isolation/spectator/reconnect history.
- Bằng chứng và ảnh: `docs/qa/chat-production/`; bản chi tiết mới nhất ở đầu `docs/TEST_REPORT.md`. Image hiện tại `e48a1cc636873d32bccca36ab2ce6ab0eff311f0b77f0177b81a58cee8859e9e`, JS `index-DWWWa_Dq.js`. VPS healthy, Nginx9000/Socket.IO đã kiểm tra. Bản runtime hoàn tất; không restart server để cập nhật tài liệu.
- Runner offline chỉ đóng WebSocket có URL `/socket.io/`; đừng đóng socket HMR của Vite. Không build shared package trong khi browser test dev đang chạy để tránh reload ngoài ý muốn. Draft hiện không persist khi reload trang; history100 và rooms lưu RAM.

### Cập nhật điều khiển và minh họa đã nghiệm thu

- Yêu cầu mới của người dùng: hình nhiều hơn, sửa combo/chọn người/chữ trắng, timeout, gợi ý và tự chơi. Đã triển khai `playAssist.ts`, `PlayCoach.tsx`, `useAutoPlay.ts`, shared `play-policy.ts` dùng chung engine/web; 22 cảnh SVG trong `art/CardScene.tsx` và bốn renderer style.
- Đã sửa selection đơn/nhóm/bắt buộc, target buttons, requested type buttons, preview, server-clock offset, passed Nope reconnect và mutex chống bấm kép. Tự chơi opt-in, tắt mỗi ván, chỉ dùng dữ liệu riêng đã lọc, hủy khi chọn bài/tab ẩn/offline/revision đổi.
- Unit/integration hiện **70 tests PASS = engine36 + server24 + web10**, typecheck/build/encoding PASS. Ba UI chuẩn bị bài PASS: cặp/bộ ba/Favor/Hamster, timer và auto cancellation; lệch giờ trình duyệt +120s có test thật. Bảy UI trên VPS HTTPS PASS, gồm ván tự chơi đến thắng/rematch; HTTP9000 UI và forced WS/polling full games PASS. Nope hiển thị người đánh, mục tiêu và tên bài bộ ba yêu cầu. Chọn thêm lá khi nhóm đã đủ thay lá cuối, không phá cả nhóm.
- Xem thư mục `docs/qa/improvements-*` và phần mới nhất của `docs/TEST_REPORT.md` để biết kết quả nghiệm thu/deploy thực sự. Các kết quả baseline phía dưới thuộc release cũ. Không nhận kết quả chạy dở là PASS.
- Nếu chưa triển khai bản mới: build rồi đóng gói source, chạy `deploy/start-release.sh` + `deploy/verify-release.sh` trên VPS. Kiểm tra không có kết nối backend trước restart. Chạy bộ browser production và hai transport sau deploy. Không chạy fixture control trên VPS.
- Release cuối đã triển khai: image `cbd196352004a13a99fc696852306df5464439ff58e467d0b0a193ae3b6b50e8`, JS `index-CmGcuH0H.js`. Sau chốt: UI2/2 PASS trong47,5s; controlled3/3 PASS trong14,6s. `docs/qa/improvements-final-release` và `docs/qa/improvements-controlled` là bằng chứng cuối. Các tính năng người dùng yêu cầu trong lượt này đã hoàn tất; tiếp tục theo yêu cầu mới hoặc giới hạn đã ghi, không lặp lại các thay đổi đã triển khai.

- Monorepo shared/engine/server/web, server Socket.IO authoritative, guest token, room queue, revision/idempotency, timer, private/public/spectator views.
- Card instance IDs, deck/card/bomb invariants, Attack debt remaining+2, Skip một lượt, Nope chains, tất cả tám lá mở rộng và Hồi Sinh.
- Chèn Defuse: actor biết khe, public chỉ TOP/BOTTOM/MIDDLE_HIDDEN; animation giữa cố định500ms, không truyền pointer hoặc index.
- Card màu xanh Defuse, đỏ nổ/nguy hiểm, vàng/xanh utility; năm họ combo có màu riêng. Nền và responsive đã sửa; SVG gốc lazy load.
- Live event queue, snapshot không replay, âm thanh synth gốc60s, autoplay gate, mute/volume, duck, reduced motion, focus modal, spectator reconnect.
- Local browser QA: 6 scenario PASS, full games2/3/4/5, mobile emulated390×844, VI/EN, style, reconnect, privacy, winner/rematch. `docs/qa/browser-results.json` và screenshots.
- VPS UI2-browser đã PASS sau sửa Nginx alias: `docs/qa/deployed/browser-results.json`. Public link `https://beatsync-server.zney295.id.vn/kittens/`.
- Final engine36 tests PASS including96 seeded full games; server23 tests PASS; web5 tests PASS, gồm UUID fallback HTTP. Root production build/typecheck/test/encoding/audit đều PASS.
- Final production browser6 scenario PASS trên VPS HTTPS; HTTP9000 UI2 browser PASS. Forced WS và polling trên HTTPS, WS trực tiếp9000 đều full game/winner/rematch PASS. Kết quả cuối ở `docs/TEST_REPORT.md`.

## Triển khai

`vps-cong` SSH alias: ubuntu@149.118.50.176. Dùng SSH config/key có sẵn, không đọc hoặc in private key/token. Game release `/home/ubuntu/exxplore-kittens`; DockerNode24, backend container loopback3105→3001, static `/var/www/exxplore-kittens`. Không tác động các container/dịch vụ khác.

Nginx9000: `/etc/nginx/sites-enabled/kittens-9000.conf` cho localhost/IP/sslip và snippet `/etc/nginx/snippets/kittens-locations.conf`. Host HTTPS beatsync chỉ thêm `/kittens/`, giữ route ứng dụng cũ. Dùng alias giữ subpath (rewrite root cũ gây404 đã sửa). WebSocket `/kittens/socket.io/` → `127.0.0.1:3105/socket.io/` có Upgrade/Connection/http1.1/timeouts/bufferingoff. Cấu hình có backup và nginx-t trước reload.

VPS đã chạy bản mới: deadline resolve trước action muộn, WS exact origin check, settings reset readiness, host takeover120s, HTTP crypto UUID fallback. Nginx có map Connection riêng và config cuối đã kiểm tra. **Đừng tự restart VPS khi có ván đang chơi.**

Vercel đã thử anonymous deploy, nhưng link chỉ sống1giờ và đã hết hạn; chưa đăng nhập tài khoản. Config `vercel.json` sẵn sàng, backend HTTPS đang dùng được. Bản VPS là link bền vững hiện tại; không gọi anonymous Vercel là production lâu dài.

## Lệnh kiểm tra

```powershell
npm.cmd ci
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run check:encoding
npm.cmd audit
$env:QA_BASE_URL='https://beatsync-server.zney295.id.vn/kittens/'
$env:QA_ARTIFACT_DIR='docs/qa/production'
npm.cmd run test:e2e
node scripts/deployment-smoke.mjs
```

Trên VPS: `bash deploy/start-release.sh`, `bash deploy/verify-release.sh`. Chỉ restart khi không có QA/ván đang chơi; state memory bị mất qua restart. `.env` chứa exact CORS_ORIGIN, VITE_SERVER_URL, VITE_SOCKET_PATH, VITE_BASE_PATH; không in toàn bộ env.

## Công việc AGY được giao ngay

Root đã hoàn tất triển khai và kiểm thử trong phạm vi release một VPS. AGY đã thực hiện review qua stdin với quyền thông thường; `docs/qa/AGY_REVIEW.md` ghi kết quả đã đối chiếu. Các bước dưới đây là hướng dẫn khi tiếp tục phát triển hoặc khi người dùng báo lỗi mới, không phải lý do tự tạo thay đổi production.

1. Đọc rule contract, architecture, test scripts và deploy config.
2. Rà soát độc lập các lỗi logic/rò rỉ bí mật/config cụ thể còn lại, đặc biệt timer/host/reconnect/HTTP UUID/subpath.
3. Viết `docs/qa/AGY_REVIEW.md`: bằng chứng, lỗi xác nhận, giới hạn còn lại. Có thể cập nhật tài liệu trong docs; **không sửa app/engine/server/deploy và không chạy build, npm ci hoặc restart service khi root đang kiểm tra bản frozen**.
4. Nếu root đã dừng vì hết quota: dùng báo cáo + `docs/TEST_REPORT.md` hiện tại, hoàn tất phần còn thiếu có test thực. Không dùng bypass quyền, không khai hoàn thành khi không có evidence.

## Giới hạn cần công khai

Rooms/tokens ở memory một process; restart mất ván, chưa Redis/persistence/multi-replica. Đo frame là rAF headless trên i5-12450HX/Windows/Chromium153; mobile giả lập cùng CPU, chưa đo máy điện thoại thật hoặc compositor GPU. Âm nhạc nguyên bản synth cơ bản, chưa kiểm thử nghe trên mọi loa/browser. Không tự nhận đạt60FPS trên điện thoại thật. Chưa đăng nhập Vercel, không giả vờ có deployment permanent.
