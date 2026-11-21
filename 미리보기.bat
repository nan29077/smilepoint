@echo off
chcp 65001 >nul
title 스마일포인트 미리보기
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [오류] Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 22 이상 버전을 설치해 주세요.
  pause
  exit /b 1
)

set "PORT=3070"
if exist ".env" (
  for /f "tokens=1,* delims==" %%a in ('findstr /b /c:"PORT=" ".env"') do set "PORT=%%b"
)

netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if not errorlevel 1 (
  echo 미리보기 서버가 이미 실행 중입니다. 브라우저만 엽니다.
  start "" "http://localhost:%PORT%"
  timeout /t 2 >nul
  exit /b 0
)

echo ==============================================
echo   스마일포인트 미리보기 : http://localhost:%PORT%
echo   종료: 이 창에서 Ctrl+C 또는 창 닫기
echo ==============================================
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:%PORT%'"
node server.mjs
echo.
echo 서버가 종료되었습니다.
pause
