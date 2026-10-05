param([int]$Port = 8787)
$ErrorActionPreference = 'Stop'
$gameRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $gameRoot
$runtimeRoot = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
$gamePnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if ($gamePnpm) { $gamePnpm = $gamePnpm.Source }
else {
    $gamePnpm = Join-Path $runtimeRoot 'bin\fallback\pnpm.cmd'
    $env:PATH = (Join-Path $runtimeRoot 'node\bin') + ';' + $env:PATH
}
if (-not (Test-Path -LiteralPath $gamePnpm)) { throw 'Install Node.js 22+ and pnpm, then run Play Online again.' }
if (-not (Test-Path -LiteralPath 'node_modules')) {
    & $gamePnpm install --frozen-lockfile
    if ($LASTEXITCODE) { throw 'Dependency installation failed.' }
}
& $gamePnpm build
if ($LASTEXITCODE) { throw 'The game build failed.' }
New-Item -ItemType Directory -Path 'test-results' -Force | Out-Null
$tunnelCommand = Get-Command cloudflared.exe -ErrorAction SilentlyContinue
$tunnelPath = if ($tunnelCommand) { $tunnelCommand.Source } else { Join-Path $gameRoot 'test-results\cloudflared.exe' }
if (-not (Test-Path -LiteralPath $tunnelPath)) {
    Write-Host 'Downloading the Cloudflare helper for a temporary public game link...'
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile $tunnelPath
}
$gameServer = $null
$previousPort = $env:PORT
try {
    $running = $false
    try { $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2; $running = $health.ok -eq $true -and $health.game -eq 'commander-wars' } catch { }
    if (-not $running) {
        $env:PORT = [string]$Port
        $gameServer = Start-Process -FilePath (Get-Command node).Source -ArgumentList '--import','tsx','server/index.ts' -WorkingDirectory $gameRoot -WindowStyle Hidden -RedirectStandardOutput 'test-results\online-server.log' -RedirectStandardError 'test-results\online-server-error.log' -PassThru
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            if ($gameServer.HasExited) { throw 'Game server could not start. Check test-results/online-server-error.log.' }
            try { $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 1; if ($health.ok -and $health.game -eq 'commander-wars') { $running = $true; break } } catch { }
            Start-Sleep -Milliseconds 300
        }
        if (-not $running) { throw 'Game server did not become ready.' }
    }
    Write-Host "Local game: http://127.0.0.1:$Port" -ForegroundColor Cyan
    Write-Host 'Share the https://...trycloudflare.com link printed below with your friends.'
    Write-Host 'In the game, Host a lobby, choose teams/AI, then share its code or invite link.'
    Write-Host 'Keep this window open and this PC awake while playing. Ctrl+C stops internet hosting.'
    # cloudflared writes normal connection diagnostics to stderr on Windows.
    $ErrorActionPreference = 'Continue'
    & $tunnelPath tunnel --url "http://127.0.0.1:$Port" --protocol http2 2>&1 | ForEach-Object {
        $line = $_.ToString()
        if ($line -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
            $Matches[0] | Set-Content -LiteralPath 'test-results\online-url.txt'
            Write-Host "`nPLAY / SHARE: $($Matches[0])`n" -ForegroundColor Green
        } else { Write-Host $line }
    }
} finally {
    $env:PORT = $previousPort
    if ($gameServer -and -not $gameServer.HasExited) { Stop-Process -Id $gameServer.Id }
}
