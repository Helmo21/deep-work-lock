#!/usr/bin/env bash
# Removes Deep Work Lock and puts back any setting a session left changed.
set -euo pipefail

UUID="deep-work-lock@helmo21.github.io"
STATE_FILE="${XDG_STATE_HOME:-$HOME/.local/state}/deep-work-lock/session.json"

if [[ -f "$STATE_FILE" ]]; then
    echo "→ Session inachevée trouvée : restauration des réglages"
    python3 - "$STATE_FILE" <<'PY'
import json, os, subprocess, sys
dry = os.environ.get("DWL_DRY_RUN") == "1"
state = json.load(open(sys.argv[1]))
for item in state.get("saved", []):
    if item["userValue"] is None:
        cmd = ["gsettings", "reset", item["schema"], item["key"]]
    else:
        cmd = ["gsettings", "set", item["schema"], item["key"], item["userValue"]]
    if dry:
        print(" ".join(cmd))
    else:
        subprocess.run(cmd, check=False)
PY
fi

if [[ "${DWL_DRY_RUN:-}" == "1" ]]; then
    exit 0
fi

# Disabling also makes a running extension restore its settings.
gnome-extensions disable "$UUID" 2>/dev/null || true
rm -rf "$HOME/.local/share/gnome-shell/extensions/$UUID"
rm -rf "$HOME/.local/share/deep-work-lock"
rm -f "$HOME/.config/google-chrome/NativeMessagingHosts/org.deepworklock.host.json"
rm -f "$HOME/.mozilla/native-messaging-hosts/org.deepworklock.host.json"
gdbus call --session --dest org.freedesktop.impl.portal.PermissionStore \
    --object-path /org/freedesktop/impl/portal/PermissionStore \
    --method org.freedesktop.impl.portal.PermissionStore.DeletePermission \
    webextensions org.deepworklock.host snap.firefox >/dev/null 2>&1 || true
rm -rf "$(dirname "$STATE_FILE")"

echo "Deep Work Lock est désinstallé. Retire aussi l'extension dans chrome://extensions et dans about:addons (Firefox)."
