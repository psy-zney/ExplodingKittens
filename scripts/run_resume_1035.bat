@echo off
chcp 65001 >nul
cd /d "c:\Users\admin\MyProject\ExxploreKittens"
powershell.exe -ExecutionPolicy Bypass -File "c:\Users\admin\MyProject\ExxploreKittens\scripts\resume_codex.ps1" -SessionId "01a0df05-27fb-7c03-8b97-16aa62941f4f" -Prompt "Hoàn thiện dự án, build production và cấu hình Nginx reverse proxy lên VPS chạy trên cổng localhost:9000 (bao gồm HTTP và WebSocket Socket.IO), kiểm tra các file config và đảm bảo sẵn sàng chạy production." -MonitorMinutes 10
