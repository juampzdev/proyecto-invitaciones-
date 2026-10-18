#!/bin/bash
# Pide la dirección de la base de datos (DATABASE_URL) y la guarda en el archivo .env.
cd "$(dirname "$0")" || exit 1
echo
echo "=== Configurar la base de datos ==="
echo "1. Entrá a https://console.neon.tech, abrí tu proyecto y tocá \"Connect\"."
echo "2. Activá \"Show password\" y copiá la línea que empieza con postgresql://"
echo "3. Pegala acá abajo y apretá Enter."
echo
read -r -p "DATABASE_URL: " url
url="${url//\"/}"; url="${url//\'/}"; url="$(echo "$url" | xargs)"
case "$url" in
  postgres://*|postgresql://*) ;;
  *) echo "Eso no parece una dirección de PostgreSQL: tiene que empezar con postgresql://"; exit 1 ;;
esac
printf 'DATABASE_URL=%s\n' "$url" > .env
echo "Listo: se guardó el archivo .env"
