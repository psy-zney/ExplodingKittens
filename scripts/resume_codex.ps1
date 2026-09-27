param(
    [string]$SessionId = "01a0df05-27fb-7c03-8b97-16aa62941f4f",
    [string]$Prompt = "continue",
    [int]$MonitorMinutes = 10,
    [string]$LogFile = "c:\Users\admin\MyProject\ExxploreKittens\resume_codex.log"
)

$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Log {
    param([string]$Msg)
    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $line = "[$ts] $Msg"
    Write-Output $line
    try {
        $stream = [System.IO.File]::Open($LogFile, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("$line`r`n")
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Close()
    } catch {
        # Non-blocking if process stream is flushing
    }
}

Log "=========================================================="
Log "KÍCH HOẠT TIẾN TRÌNH RESUME CODEX (qua codexed)"
Log "Session ID: $SessionId"
Log "Lệnh gửi: $Prompt"
Log "Thời gian giám sát khởi tạo: $MonitorMinutes phút"
Log "=========================================================="

$workDir = "c:\Users\admin\MyProject\ExxploreKittens"
$cmdArgs = "/c chcp 65001 >nul & codexed exec resume $SessionId `"$Prompt`" >> `"$LogFile`" 2>&1"

Log "Thực thi: codexed exec resume $SessionId `"$Prompt`""

try {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "cmd.exe"
    $psi.Arguments = $cmdArgs
    $psi.WorkingDirectory = $workDir
    $psi.UseShellExecute = $true
    $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden

    $proc = [System.Diagnostics.Process]::Start($psi)
    Log "Codex wrapper process started. PID: $($proc.Id)"

    $startTime = Get-Date
    $endTime = $startTime.AddMinutes($MonitorMinutes)

    Log "Đang giám sát $MonitorMinutes phút đầu..."
    while ((Get-Date) -lt $endTime -and -not $proc.HasExited) {
        Start-Sleep -Seconds 30
        $mins = [math]::Round(((Get-Date) - $startTime).TotalMinutes, 1)
        Log "Kiểm tra phút thứ $($mins): Tiến trình (PID: $($proc.Id)) vẫn đang chạy bình thường."
    }

    if ($proc.HasExited) {
        Log "Tiến trình Codex đã hoàn tất turn với mã thoát: $($proc.ExitCode)"
    } else {
        Log "Đã hoàn thành $MonitorMinutes phút giám sát khởi tạo. Tiến trình Codex đang tiếp tục chạy nền ổn định."
    }
} catch {
    Log "LỖI khi chạy Codex: $_"
}

Log "=== KẾT THÚC ĐỢT GIÁM SÁT ==="
