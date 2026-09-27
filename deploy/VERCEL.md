# Vercel: cấu hình build và kết nối VPS

Vercel phục vụ bản web Vite. Server game Socket.IO tiếp tục chạy trên VPS; các browser Vercel gọi trực tiếp HTTPS của VPS.

## 1. Cài đặt project

Trong Project -> Settings -> Build and Deployment:

| Trường | Giá trị |
| --- | --- |
| Root Directory | Gốc repository (để trống / chọn thư mục gốc). |
| Framework Preset | Vite |
| Node.js Version | 24.x |
| Install Command | npm ci --workspaces --include-workspace-root --include=dev |
| Build Command | npm run build -w @kittens/shared && npm run build -w @kittens/web |
| Output Directory | apps/web/dist |

Các command và output đã nằm trong vercel.json tại gốc repo. Đối chiếu các override trên Dashboard với bảng này. Root Directory phải truy cập được cả package-lock.json, packages/shared và apps/web. Sau khi đổi cài đặt, Redeploy commit mới; tắt Use existing Build Cache ở lần sửa lỗi này.

[Vercel build settings](https://vercel.com/docs/builds/configure-a-build) và [Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) mô tả các trường trên. Bản game đã build bằng Node24 trên VPS và trong kiểm tra checkout sạch.

## 2. Environment Variables của Vercel

Trong Project -> Settings -> Environment Variables, thêm cho Production (và Preview nếu cần):

| Key | Value |
| --- | --- |
| VITE_SERVER_URL | https://beatsync-server.zney295.id.vn |
| VITE_SOCKET_PATH | /kittens/socket.io |
| VITE_BASE_PATH | / |

File mẫu: deploy/vercel.env.example. URL server là origin HTTPS; đường dẫn Socket.IO được đặt riêng. Base của web trên domain Vercel là /, còn /kittens/ là base của bản web trên VPS.

Các giá trị VITE được nhúng khi build. Lưu ENV rồi tạo deployment mới để áp dụng; sửa ENV không cập nhật deployment cũ. Xem [Vercel Environment Variables](https://vercel.com/docs/environment-variables) và [Vite env](https://vite.dev/guide/env-and-mode).

Lệnh install đã ép include devDependencies; React types, TypeScript, Vite và plugin React cần có trong build. Nếu project đang có NPM_CONFIG_WORKSPACES=false, NPM_CONFIG_WORKSPACE trỏ riêng một package, hoặc NPM_CONFIG_IGNORE_SCRIPTS=true, gỡ các override đó để command ở trên chạy đúng. Vite tự build production qua vite build; không cần thêm NODE_ENV thủ công.

## 3. Cho phép domain Vercel trên server VPS

Server kiểm tra exact Origin cho cả WebSocket và polling. Chỉ đặt ENV web chưa đủ để một domain mới kết nối được.

Thay domain.example.vercel.app bằng **domain production thực tế**, không thêm path hay dấu / cuối:

    cd /home/ubuntu/exxplore-kittens
    python3 deploy/add-origin.py https://domain.example.vercel.app
    bash deploy/start-release.sh
    bash deploy/verify-release.sh

CORS_ORIGIN thuộc .env của VPS, giữ những origin hiện có và thêm domain mới bằng script. Recreate backend mới áp dụng ENV; hoàn thành các phòng đang mở trước bước này vì room/session đang ở RAM. Script release dừng nếu backend còn kết nối.

Nếu kiểm tra Preview bằng URL khác domain production, origin Preview đó cũng cần được cho phép riêng. Không mặc định cho phép mọi domain vercel.app.

## 4. Lỗi React/module trong log

React, React DOM, @types/react, @types/react-dom và @vitejs/plugin-react đã có trong apps/web/package.json và package-lock.json. Log TS2307/TS2875 cho thấy các module/type chưa được resolve trong môi trường build. TS7006 ở callback state có thể là lỗi kéo theo khi mất type React.

Kiểm tra trên checkout sạch với install chỉ workspace shared: shared build PASS nhưng web dừng vì thiếu vite/client. Đây là bằng chứng workspace install thiếu dependency web; chưa có install log Vercel để xác định chính xác override gây lỗi TS2307 của deployment đó. Cài từ gốc với tất cả workspaces và include=dev xử lý cả giới hạn workspace lẫn việc bỏ devDependencies. Không đổi annotation trong component để che lỗi dependency.

## 5. Kiểm tra sau Redeploy

- Deployment dùng commit có installCommand mới và trạng thái Ready.
- Mở link production; mascot/nhạc/SFX tải dưới domain web với base /.
- Network có WebSocket tới wss://beatsync-server.zney295.id.vn/kittens/socket.io/?EIO=4&transport=websocket.
- Mở hai browser guest, tạo/join phòng, chọn Cứu Nổ, chơi đến thắng và rematch.
- Nếu Ready nhưng báo offline, kiểm tra Origin của request và allowlist VPS; nếu TS2307 còn xuất hiện, đối chiếu install log, Root Directory và command override.

Chưa có domain production hay quyền truy cập project Vercel trong phiên này để xác nhận deployment Ready từ Dashboard. Kết quả cài/build trên checkout sạch được ghi ở đầu docs/TEST_REPORT.md.
