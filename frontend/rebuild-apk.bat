@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM --- Java: Android Studio JBR / common JDKs ---
if not defined JAVA_HOME (
  if exist "C:\Program Files\Android\Android Studio\jbr" (
    set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
  ) else if exist "%LOCALAPPDATA%\Programs\Android Studio\jbr" (
    set "JAVA_HOME=%LOCALAPPDATA%\Programs\Android Studio\jbr"
  ) else if exist "C:\Program Files\Android\Android Studio\jre" (
    set "JAVA_HOME=C:\Program Files\Android\Android Studio\jre"
  ) else if exist "C:\Program Files\Java\jdk-17" (
    set "JAVA_HOME=C:\Program Files\Java\jdk-17"
  )
)

if not defined JAVA_HOME (
  echo JAVA_HOME is not set and Android Studio JBR was not found.
  echo Open Android Studio once, or set JAVA_HOME to your JDK 17+.
  pause
  exit /b 1
)

set "PATH=%JAVA_HOME%\bin;%PATH%"
echo Using JAVA_HOME=%JAVA_HOME%
"%JAVA_HOME%\bin\java.exe" -version 2>&1
if errorlevel 1 (
  echo FAILED: java not runnable at JAVA_HOME
  pause
  exit /b 1
)

echo.
echo === 1/2 Sync: build frontend + cap sync android ===
call npm run android:sync
if errorlevel 1 (
  echo.
  echo FAILED: android:sync
  pause
  exit /b 1
)

if not exist "android\gradlew.bat" (
  echo.
  echo FAILED: folder android not found. Run: npm run android:add
  pause
  exit /b 1
)

echo.
echo === 2/2 Build debug APK ===
cd android
call gradlew.bat assembleDebug
if errorlevel 1 (
  echo.
  echo FAILED: gradle assembleDebug
  echo Tip: or Build -^> Generate App Bundles or APKs -^> Generate APKs in Android Studio
  pause
  exit /b 1
)

echo.
echo OK. APK:
echo   %cd%\app\build\outputs\apk\debug\app-debug.apk
explorer "app\build\outputs\apk\debug"
pause
