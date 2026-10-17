@echo off
REM Doble clic para iniciar la web en Windows.
cd /d "%~dp0"
where node >nul 2>nul || (echo No se encontro Node.js. Instalalo desde https://nodejs.org & pause & exit /b 1)
if not exist .env (
  copy .env.example .env >nul
  echo Se creo el archivo .env. Abrilo con el Bloc de notas, completa DATABASE_URL y volve a ejecutar este archivo.
  notepad .env
  pause
  exit /b 1
)
REM Instala o actualiza las dependencias (si ya estan al dia tarda un par de segundos).
call npm install --no-audit --no-fund || (pause & exit /b 1)
set ABRIR_NAVEGADOR=1
call npm start
pause
