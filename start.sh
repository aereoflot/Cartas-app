#!/usr/bin/env bash
# Arranca la app. Existe porque en este equipo Node está instalado dentro de WSL
# (~/.local/node) y no en el PATH por defecto: el `node` de Windows no sirve,
# porque no entiende las rutas de WSL.
#
#   ./start.sh          -> servidor de desarrollo en http://localhost:5173
#   ./start.sh test     -> pruebas de la app
#   ./start.sh build    -> compilar
set -euo pipefail
export PATH="$HOME/.local/node/bin:$PATH"
cd "$(dirname "${BASH_SOURCE[0]}")"

case "${1:-dev}" in
  dev)   exec npm run dev ;;
  test)  exec npm test ;;
  build) exec npm run build ;;
  *)     exec npm run "$@" ;;
esac
