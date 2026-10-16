@echo off
REM Doble clic para iniciar la web en Windows.
cd /d "%~dp0"
where node >nul 2>nul || (echo No se encontro Node.js. Instalalo desde https://nodejs.org & pause & exit /b 1)
if not exist node_modules (
  echo Instalando dependencias, solo la primera vez...
  call npm install || (pause & exit /b 1)
)
set ABRIR_NAVEGADOR=1
call npm start
pause
