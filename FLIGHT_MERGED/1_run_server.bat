@echo off
title 15_Kiki-Islands
echo Setting Node 20 PATH...
set PATH=C:\Users\macie\.gemini\antigravity\node20;%PATH%
cd /d "%~dp0"
echo Fixing Node dependencies (this takes a few seconds)... && call npm install && call npm run dev -- --open
pause
