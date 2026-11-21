@echo off
chcp 65001 >nul
title 스마일포인트 서버 종료
cd /d "%~dp0"

set "PORT=3070"
if exist ".env" (
  for /f "tokens=1,* delims==" %%a in ('findstr /b /c:"PORT=" ".env"') do set "PORT=%%b"
)

set "FOUND="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":%PORT% .*LISTENING"') do (
  if not "%%p"=="0" (
    set "FOUND=1"
    echo 포트 %PORT% 에서 실행 중인 서버(PID %%p)를 종료합니다...
    taskkill /PID %%p /T /F >nul 2>nul
  )
)

if defined FOUND (
  echo 스마일포인트 미리보기 서버를 종료했습니다.
) else (
  echo 포트 %PORT% 에서 실행 중인 서버가 없습니다.
)
timeout /t 3 >nul
