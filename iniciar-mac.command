#!/bin/bash
# Doble clic para iniciar la web en Mac (o ./iniciar-mac.command en Linux).
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "No se encontró Node.js. Instalalo desde https://nodejs.org"
  read -r -p "Apretá Enter para cerrar..."
  exit 1
fi
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Se creó el archivo .env. Completá DATABASE_URL y volvé a ejecutar este archivo."
  open -e .env 2>/dev/null || true
  read -r -p "Apretá Enter para cerrar..."
  exit 1
fi
# Instala o actualiza las dependencias (si ya están al día tarda un par de segundos).
npm install --no-audit --no-fund || exit 1
ABRIR_NAVEGADOR=1 npm start
