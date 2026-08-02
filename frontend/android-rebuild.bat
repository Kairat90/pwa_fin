@echo off
cd /d "%~dp0"
echo Building and syncing Android (needs frontend\.env)...
call npm run android:sync
if errorlevel 1 (
  echo FAILED
  exit /b 1
)
echo OK - now Build APK in Android Studio
pause
