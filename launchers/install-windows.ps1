# install-windows.ps1 — create double-clickable AgentScore shortcuts (Desktop +
# Start Menu) with the icon, pointing at this checkout. Run once:
#   powershell -ExecutionPolicy Bypass -File launchers\install-windows.ps1
$here = Split-Path -Parent $MyInvocation.MyCommand.Path        # launchers\
$bat  = Join-Path $here "launch-windows.bat"
$ico  = Join-Path $here "icon.ico"
$ws   = New-Object -ComObject WScript.Shell
foreach ($dir in @([Environment]::GetFolderPath("Desktop"), [Environment]::GetFolderPath("Programs"))) {
  try {
    $path = Join-Path $dir "AgentScore.lnk"
    $lnk = $ws.CreateShortcut($path)
    $lnk.TargetPath        = $bat
    $lnk.WorkingDirectory  = $here
    $lnk.IconLocation      = $ico
    $lnk.Description        = "AgentScore - music composer for AI agents"
    $lnk.Save()
    Write-Host "created: $path"
  } catch { Write-Host "skip ${dir}: $($_.Exception.Message)" }
}
Write-Host "Done. Double-click AgentScore on your Desktop or in the Start Menu."
