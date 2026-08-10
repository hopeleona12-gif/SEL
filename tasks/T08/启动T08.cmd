@echo off
setlocal
cd /d "%~dp0"

set "T08_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%T08_NODE%" set "T08_NODE=%LOCALAPPDATA%\OpenAI\Codex\runtimes\cua_node\f1bf3cd3a5929acd\bin\node.exe"

if not exist "%T08_NODE%" (
  echo Node.js was not found. T08 cannot start.
  pause
  exit /b 1
)

echo Starting T08. Keep this window open.
start "" "http://127.0.0.1:8088/"
"%T08_NODE%" server.js

echo.
echo T08 server stopped.
pause
