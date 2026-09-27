@echo off
chcp 65001 >nul
cd /d "c:\Users\admin\MyProject\ExxploreKittens"
powershell.exe -ExecutionPolicy Bypass -File "c:\Users\admin\MyProject\ExxploreKittens\scripts\resume_codex.ps1" -SessionId "01a0df05-27fb-7c03-8b97-16aa62941f4f" -Prompt "Tiếp tục và phát triển tính năng game toàn diện: hoàn thiện luật chơi, logic bài, tính năng phòng, realtime websocket, giao diện, âm thanh và test kỹ lưỡng." -MonitorMinutes 10
