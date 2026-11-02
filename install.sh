#!/usr/bin/env bash
# Installs Deep Work Lock for the current user (GNOME extension + native host
# for Chrome and Firefox).
set -euo pipefail

ROOT="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
UUID="deep-work-lock@deepwork.local"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
HOST_DIR="$HOME/.local/share/deep-work-lock"
HOST_MANIFEST_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
HOST_NAME="org.deepworklock.host"
FIREFOX_MANIFEST_DIR="$HOME/.mozilla/native-messaging-hosts"
GECKO_ID="deep-work-lock@deepwork.local"

echo "→ Extension GNOME : $EXT_DIR"
mkdir -p "$(dirname "$EXT_DIR")"
rm -rf "$EXT_DIR"
cp -r "$ROOT/gnome-extension/$UUID" "$EXT_DIR"

echo "→ Hôte de messagerie native : $HOST_DIR"
mkdir -p "$HOST_DIR"
install -m 755 "$ROOT/native-host/deep_work_lock_host.py" "$HOST_DIR/deep_work_lock_host.py"

# The Chrome extension id is derived from the public key in its manifest.
EXT_ID="$(python3 - "$ROOT/chrome-extension/manifest.json" <<'PY'
import base64, hashlib, json, sys
key = json.load(open(sys.argv[1]))["key"]
digest = hashlib.sha256(base64.b64decode(key)).hexdigest()[:32]
print("".join(chr(ord("a") + int(c, 16)) for c in digest))
PY
)"

mkdir -p "$HOST_MANIFEST_DIR"
cat > "$HOST_MANIFEST_DIR/$HOST_NAME.json" <<JSON
{
  "name": "$HOST_NAME",
  "description": "Deep Work Lock bridge between Chrome and GNOME Shell",
  "path": "$HOST_DIR/deep_work_lock_host.py",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXT_ID/"]
}
JSON
echo "→ Manifeste de l'hôte : $HOST_MANIFEST_DIR/$HOST_NAME.json"

mkdir -p "$FIREFOX_MANIFEST_DIR"
cat > "$FIREFOX_MANIFEST_DIR/$HOST_NAME.json" <<JSON
{
  "name": "$HOST_NAME",
  "description": "Deep Work Lock bridge between Firefox and GNOME Shell",
  "path": "$HOST_DIR/deep_work_lock_host.py",
  "type": "stdio",
  "allowed_extensions": ["$GECKO_ID"]
}
JSON
echo "→ Manifeste de l'hôte Firefox : $FIREFOX_MANIFEST_DIR/$HOST_NAME.json"

# Firefox in a snap reaches the host through the WebExtensions portal, which
# asks once per host. Its dialog can fail to show, and an unanswered request
# is stored as a refusal, so grant this one host up front.
if [[ -x /snap/bin/firefox ]]; then
    if gdbus call --session --dest org.freedesktop.impl.portal.PermissionStore \
        --object-path /org/freedesktop/impl/portal/PermissionStore \
        --method org.freedesktop.impl.portal.PermissionStore.SetPermission \
        webextensions true "$HOST_NAME" snap.firefox "['yes']" >/dev/null 2>&1; then
        echo "→ Portail : Firefox (snap) autorisé à lancer $HOST_NAME, et rien d'autre."
    else
        echo "→ Portail injoignable : Firefox demandera l'autorisation au premier lancement."
    fi
fi

if command -v node >/dev/null; then
    node "$ROOT/scripts/build-firefox.mjs" "$ROOT/build/firefox" >/dev/null
    echo "→ Extension Firefox construite : $ROOT/build/firefox"
else
    echo "→ Node absent : extension Firefox non construite (node scripts/build-firefox.mjs)."
fi

if [[ "${DWL_NO_ENABLE:-}" != "1" ]]; then
    if gnome-extensions enable "$UUID" 2>/dev/null; then
        echo "→ Extension GNOME activée."
    else
        echo "→ GNOME Shell ne connaît pas encore l'extension."
    fi
fi

cat <<TXT

Encore trois étapes :

1. Recharger GNOME Shell pour qu'il découvre l'extension :
   déconnecte-toi puis reconnecte-toi (ou Alt+F2, tape r, Entrée en X11),
   puis lance :  gnome-extensions enable $UUID

2. Charger l'extension Chrome :
   chrome://extensions → active « Mode développeur » →
   « Charger l'extension non empaquetée » → choisis le dossier
   $ROOT/chrome-extension
   Son identifiant doit être : $EXT_ID

3. Installer l'extension Firefox :
   - signée (fichier .xpi, voir scripts/sign-firefox.sh) : glisse le .xpi dans
     une fenêtre Firefox, ou about:addons → ⚙ → « Installer un module depuis un fichier » ;
   - en attendant la signature, pour tester (retirée à la fermeture de Firefox) :
     about:debugging#/runtime/this-firefox → « Charger un module complémentaire temporaire »
     → $ROOT/build/firefox/manifest.json

L'icône « ◉ Focus » apparaît alors à droite de la barre du haut.
TXT
