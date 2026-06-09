# serve.ps1 — tiny static file server for AgentScore on Windows (no Python needed).
# Serves the app folder over http://127.0.0.1:<port>/ with correct MIME types
# (ES modules require text/javascript) and opens the default browser.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)  # repo root (parent of launchers/)

$port = 8910
function Test-Port($p) { try { $l=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,$p); $l.Start(); $l.Stop(); $true } catch { $false } }
while (-not (Test-Port $port)) { $port++ }

$mime = @{
  ".html"="text/html"; ".js"="text/javascript"; ".mjs"="text/javascript"; ".css"="text/css";
  ".json"="application/json"; ".png"="image/png"; ".jpg"="image/jpeg"; ".svg"="image/svg+xml";
  ".mp3"="audio/mpeg"; ".wav"="audio/wav"; ".ico"="image/x-icon"; ".md"="text/markdown"; ".woff2"="font/woff2"
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()
$url = "http://127.0.0.1:$port/"
Write-Host "AgentScore serving $root at $url  (close this window to stop)"
Start-Process $url

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq "") { $rel = "index.html" }
    $path = Join-Path $root $rel
    # prevent path traversal outside the app root
    $full = [System.IO.Path]::GetFullPath($path)
    if (-not $full.StartsWith([System.IO.Path]::GetFullPath($root))) { $ctx.Response.StatusCode = 403; $ctx.Response.Close(); continue }
    if (Test-Path $full -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $ctx.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $ctx.Response.StatusCode = 404 }
    $ctx.Response.Close()
  }
} finally { $listener.Stop() }
