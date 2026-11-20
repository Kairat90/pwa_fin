@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM --- Java 21. Studio JBR 25 несовместим с Gradle 8.14 (class file 69). ---
if not defined JAVA_HOME (
  if exist "%USERPROFILE%\.jdks\jbr-21.0.11" (
    set "JAVA_HOME=%USERPROFILE%\.jdks\jbr-21.0.11"
  ) else if exist "C:\Program Files\Java\jdk-21" (
    set "JAVA_HOME=C:\Program Files\Java\jdk-21"
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
echo === 0/2 npm install ===
call npm install
if errorlevel 1 (
  echo.
  echo FAILED: npm install
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
