#!/usr/bin/env bash
# Builds the Firefox extension and has Mozilla sign it as "unlisted" (not
# published on addons.mozilla.org). Keys come from the environment, never
# from the repository:
#   WEB_EXT_API_KEY=user:… WEB_EXT_API_SECRET=… scripts/sign-firefox.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
: "${WEB_EXT_API_KEY:?WEB_EXT_API_KEY manquant (addons.mozilla.org → Outils → Gérer les clés API)}"
: "${WEB_EXT_API_SECRET:?WEB_EXT_API_SECRET manquant}"

node "$ROOT/scripts/build-firefox.mjs" "$ROOT/build/firefox"
npx --yes web-ext@10.7.0 sign \
    --channel unlisted \
    --source-dir "$ROOT/build/firefox" \
    --artifacts-dir "$ROOT/web-ext-artifacts"

echo
echo "Extension signée :"
ls -1t "$ROOT"/web-ext-artifacts/*.xpi | head -1
echo "Installe-la en la glissant dans une fenêtre Firefox (ou about:addons → ⚙ → Installer un module depuis un fichier)."
