@echo off
chcp 65001 >nul
title ChatBox Pro
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
echo ==========================================
echo   ChatBox Pro 启动中...
echo ==========================================
echo.
node server\index.mjs
echo.
echo 服务已退出。按任意键关闭窗口。
pause >nul
