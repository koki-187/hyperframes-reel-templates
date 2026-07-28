@echo off
cd /d "%~dp0.."
if not exist node_modules call npm install
start "MAW HYPERFRAME" cmd /c npm start
timeout /t 2 >nul
start http://127.0.0.1:4314
