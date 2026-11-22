@echo off
title QipaPiano Web
rem 定位到本 bat 所在目录(仓库 server/),不依赖任何硬编码路径
cd /d "%~dp0"
rem kill old server on port 8766 first (safe to double-click)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8766" ^| findstr "LISTENING"') do taskkill /F /PID %%p 2>nul
start "" "http://127.0.0.1:8766/?v=%RANDOM%%RANDOM%"
node server.js
pause
