@echo off
setlocal
cd /d "%~dp0"

set "T08_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%T08_NODE%" set "T08_NODE=%LOCALAPPDATA%\OpenAI\Codex\runtimes\cua_node\f1bf3cd3a5929acd\bin\node.exe"

if not exist "%T08_NODE%" (
  echo ERROR: Node.js was not found.
  echo ERROR: Node.js was not found.>startup-error.log
  pause
  exit /b 1
)

echo Starting T08 on http://127.0.0.1:8088/
echo Keep this window open while using T08.
echo.
"%T08_NODE%" server.js

echo.
echo ERROR: T08 stopped. See startup-error.log.
echo T08 stopped at %DATE% %TIME%>startup-error.log
pause
