#!/bin/bash
# Doble clic para iniciar la web en Mac (o ./iniciar-mac.command en Linux).
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "No se encontró Node.js. Instalalo desde https://nodejs.org"
  read -r -p "Apretá Enter para cerrar..."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Instalando dependencias, solo la primera vez..."
  npm install || exit 1
fi
ABRIR_NAVEGADOR=1 npm start
