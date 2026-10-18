@echo off
REM Pide la direccion de la base de datos (DATABASE_URL) y la guarda en el archivo .env.
REM Se puede volver a ejecutar cuando quieras cambiarla.
cd /d "%~dp0"
echo.
echo === Configurar la base de datos ===
echo.
echo 1. Entra a https://console.neon.tech, abri tu proyecto y toca "Connect".
echo 2. Activa "Show password" y copia la linea que empieza con postgresql://
echo 3. Pegala aca abajo (clic derecho pega) y apreta Enter.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$u = (Read-Host 'DATABASE_URL').Trim().Trim([char]34).Trim([char]39).Trim(); if ($u -notmatch '^postgres(ql)?://') { Write-Host ''; Write-Host 'Eso no parece una direccion de PostgreSQL: tiene que empezar con postgresql://' -ForegroundColor Red; exit 1 }; [IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), 'DATABASE_URL=' + $u + [char]10); Write-Host ''; Write-Host 'Listo: se guardo el archivo .env' -ForegroundColor Green"
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)
echo.
