@echo off
setlocal
cd /d "%~dp0"
rem Prefer an installed pnpm; otherwise use the bundled Codex runtime on this PC.
set "GAME_PNPM=pnpm.cmd"
where pnpm.cmd >nul 2>nul
if errorlevel 1 (
  set "GAME_PNPM=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"
  set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
)
if not exist node_modules (
  call "%GAME_PNPM%" install
  if errorlevel 1 goto failed
)
call "%GAME_PNPM%" build
if errorlevel 1 goto failed
echo Commander Wars: open http://127.0.0.1:8787 in your browser.
echo Keep this window open while playing. Close it to stop the server.
start "" "http://127.0.0.1:8787"
call "%GAME_PNPM%" start
if errorlevel 1 goto failed
exit /b 0
:failed
echo If another game server is already running, open http://127.0.0.1:8787.
echo Otherwise install Node.js 22+ and pnpm, then try again.
pause
exit /b 1
