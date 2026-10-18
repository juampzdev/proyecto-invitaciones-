@echo off
REM Doble clic para iniciar la web en Windows.
REM Pasos: 1) trae los cambios de GitHub, 2) pide la base de datos si falta .env,
REM 3) instala/actualiza dependencias, 4) arranca el servidor y abre el navegador.
REM Todo va dentro de un bloque ( ... ): Windows lo lee completo antes de ejecutarlo,
REM asi no se rompe aunque "git pull" actualice este mismo archivo.
cd /d "%~dp0"
(
  where node >nul 2>nul || (echo No se encontro Node.js. Instalalo desde https://nodejs.org & pause & exit /b 1)
  if exist .git (
    echo Buscando actualizaciones en GitHub...
    git pull --ff-only || echo No se pudo actualizar. Se usa la version que ya tenes.
  )
  if not exist .env (
    call configurar-base-de-datos.bat || exit /b 1
  )
  call npm install --no-audit --no-fund || (pause & exit /b 1)
  set ABRIR_NAVEGADOR=1
  call npm start
  pause
  exit /b 0
)
