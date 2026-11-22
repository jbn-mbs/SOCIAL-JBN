# Registers a Windows scheduled task that runs the daily reel job every day.
#   powershell -ExecutionPolicy Bypass -File scripts\install-schedule.ps1            # 09:00 daily
#   powershell -ExecutionPolicy Bypass -File scripts\install-schedule.ps1 -Time 18:30
#   powershell -ExecutionPolicy Bypass -File scripts\install-schedule.ps1 -Remove
# The computer must be on (and you logged in) at that time; if it was off, the task runs at the next chance.
param(
  [string]$Time = "09:00",
  [switch]$Remove
)

$TaskName = "careerGUIDE daily reel"
$Root = Split-Path -Parent $PSScriptRoot

if ($Remove) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Removed scheduled task '$TaskName'."
  exit 0
}

$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
# Append each run's output to data\daily.log.
$cmd = "cd /d `"$Root`" && `"$npm`" run daily >> data\daily.log 2>&1"
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c $cmd" -WorkingDirectory $Root
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1) -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
  -Description "Writes, renders and sends the daily careerGUIDE reel to the manager on Telegram." -Force | Out-Null
Write-Host "Scheduled '$TaskName' daily at $Time. Log: $Root\data\daily.log"
