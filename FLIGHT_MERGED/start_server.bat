@echo off
title 15_Kiki-Islands
cd /d "%~dp0"
echo Starting local server for 15_Kiki-Islands at http://localhost:8113/
start "" "http://localhost:8113/"
python server.py
pause
