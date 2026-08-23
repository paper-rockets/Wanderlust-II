@echo off
title EZ-Tree Server
cd /d "%~dp0ez-tree"
echo ========================================================
echo Starting EZ-Tree Server...
echo ========================================================
npm run dev
