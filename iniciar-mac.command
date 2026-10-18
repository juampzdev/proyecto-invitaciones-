#!/bin/bash
# Doble clic para iniciar la web en Mac (o ./iniciar-mac.command en Linux).
# Todo va dentro de main(): bash lo lee completo antes de ejecutarlo,
# así no se rompe aunque "git pull" actualice este mismo archivo.
main() {
  cd "$(dirname "$0")" || exit 1
  if ! command -v node >/dev/null 2>&1; then
    echo "No se encontró Node.js. Instalalo desde https://nodejs.org"
    read -r -p "Apretá Enter para cerrar..."
    exit 1
  fi
  # Trae los últimos cambios de GitHub (si falla, sigue con la versión que ya tenés).
  if [ -d .git ] && command -v git >/dev/null 2>&1; then
    echo "Buscando actualizaciones en GitHub..."
    git pull --ff-only || echo "No se pudo actualizar. Se usa la versión que ya tenés."
  fi
  if [ ! -f .env ]; then
    ./configurar-base-de-datos.command || exit 1
  fi
  # Instala o actualiza las dependencias (si ya están al día tarda un par de segundos).
  npm install --no-audit --no-fund || exit 1
  ABRIR_NAVEGADOR=1 npm start
}
main "$@"
exit
