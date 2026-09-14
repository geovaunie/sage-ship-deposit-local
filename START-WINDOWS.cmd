@echo off
title SAGE Local - keep this window open while depositing
cd /d "%~dp0"
if not exist "runtime\node.exe" (
  echo The Windows runtime executable is missing from this download.
  echo Download the WINDOWS-APP ZIP from GitHub Releases and Extract All.
  echo GitHub's Source code ZIP is for developers, not the ready-to-run app.
  echo https://github.com/geovaunie/sage-ship-deposit-local/releases
  pause
  exit /b 1
)
echo Opening SAGE Local in your browser...
echo Keep this window open. Close it when you finish.
"runtime\node.exe" scripts/serve.mjs --open
pause
