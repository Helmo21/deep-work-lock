#!/usr/bin/env bash
# Deep Work Lock uninstaller, meant to be run as:
#   curl -fsSL <site>/uninstall.sh | bash
#
# Removes the GNOME extension, puts back any setting an unfinished session
# left changed, removes the native-messaging manifests and the browser
# policies (one sudo), then the state folder.
#
# Same DWL_* overrides as install.sh. DWL_DRY_RUN=1 is a test knob: it
# prints each command that would change the system instead of running it,
# but gdbus still runs in dry-run (UninstallExtension, PermissionStore), so
# never use DWL_DRY_RUN without a fake gdbus first in PATH. The body lives in
# main(), called on the last line, and nothing reads stdin.
# SPDX-License-Identifier: GPL-3.0-or-later
set -euo pipefail

SITE_URL="${DWL_SITE_URL:-https://deepwork-lock.up.railway.app}"
UUID="${DWL_UUID:-deep-work-lock@helmo21.github.io}"
REPO="${DWL_REPO:-Helmo21/deep-work-lock}"
CHROME_ID="${DWL_CHROME_ID:-llneijbapcdcjcbkecnkdmfaekhpimjl}"
GECKO_ID="${DWL_GECKO_ID:-deep-work-lock@deepwork.local}"
HOST_NAME="${DWL_HOST_NAME:-org.deepworklock.host}"
HOME_DIR="${DWL_HOME:-$HOME}"
ETC_DIR="${DWL_ETC:-/etc}"
SUDO="${DWL_SUDO:-sudo}"
GDBUS="${DWL_GDBUS:-gdbus}"
GNOME_EXTENSIONS="${DWL_GNOME_EXTENSIONS:-gnome-extensions}"
GSETTINGS="${DWL_GSETTINGS:-gsettings}"
CURL="${DWL_CURL:-curl}"
DRY_RUN="${DWL_DRY_RUN:-0}"
# Same folder as lib/stateStore.js (GLib.get_user_state_dir()/deep-work-lock).
# A test home never looks at the real XDG_STATE_HOME.
if [[ -n "${DWL_HOME:-}" ]]; then
    STATE_DIR="$HOME_DIR/.local/state/deep-work-lock"
else
    STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/deep-work-lock"
fi

step() { printf '→ %s\n' "$*"; }
say() { printf '  %s\n' "$*"; }
fail() {
    local code="$1"
    shift
    printf '\n' >&2
    printf '%s\n' "$@" >&2
    exit "$code"
}

# Runs a command that changes the system, or only prints it in dry-run mode.
run() {
    if [[ "$DRY_RUN" == "1" ]]; then
        printf '+'
        printf ' %q' "$@"
        printf '\n'
    else
        "$@" </dev/null
    fi
}

get_policies_py() {
    if [[ "$(id -u)" == "0" ]]; then
        fail 1 "Deep Work Lock was installed for your own account: run the command as your normal user, not as root." \
            "Nothing was changed."
    fi
    local marker="@""@" value  # split so that publishing does not substitute it away
    for value in "$SITE_URL" "$UUID" "$REPO" "$CHROME_ID" "$GECKO_ID" "$HOST_NAME"; do
        [[ "$value" == *"$marker"* ]] || continue
        fail 1 "This copy of uninstall.sh was not prepared for publishing." \
            "Nothing was changed. Use the uninstall command shown on the Deep Work Lock website."
    done
    if [[ -n "${DWL_POLICIES_PY:-}" ]]; then
        POLICIES_PY="$DWL_POLICIES_PY"
        return
    fi
    POLICIES_PY="$WORK_DIR/policies.py"
    if ! run "$CURL" -fsSL -o "$POLICIES_PY" "$SITE_URL/policies.py"; then
        fail 1 "Deep Work Lock could not download $SITE_URL/policies.py" \
            "Nothing was changed. Check your connection and run the command again."
    fi
}

remove_gnome_extension() {
    step "Removing the GNOME extension"
    local result
    # Uninstalling disables it first, which makes a running extension put
    # back the settings of a session in progress.
    result="$("$GDBUS" call --session --dest org.gnome.Shell.Extensions \
        --object-path /org/gnome/Shell/Extensions \
        --method org.gnome.Shell.Extensions.UninstallExtension "$UUID" </dev/null 2>&1 || true)"
    if [[ "$result" != *true* ]]; then
        run "$GNOME_EXTENSIONS" disable "$UUID" 2>/dev/null || true
        run rm -rf "$HOME_DIR/.local/share/gnome-shell/extensions/$UUID"
    fi
    # Host copy left by the old developer install.
    run rm -rf "$HOME_DIR/.local/share/deep-work-lock"
    forget_in_gsettings
}

# Removes the UUID from enabled-extensions and disabled-extensions.
forget_in_gsettings() {
    if [[ "$DRY_RUN" == "1" ]]; then
        printf '+ %s: remove %s from org.gnome.shell enabled-extensions and disabled-extensions\n' "$GSETTINGS" "$UUID"
        return 0
    fi
    python3 - "$GSETTINGS" "$UUID" <<'PY' || say "Could not update org.gnome.shell enabled-extensions; nothing else depends on it."
import ast, subprocess, sys
gsettings, uuid = sys.argv[1], sys.argv[2]
for key in ("enabled-extensions", "disabled-extensions"):
    raw = subprocess.run([gsettings, "get", "org.gnome.shell", key], check=True,
                         capture_output=True, text=True, stdin=subprocess.DEVNULL).stdout.strip()
    if raw.startswith("@as "):
        raw = raw[4:]
    current = list(ast.literal_eval(raw)) if raw else []
    if uuid in current:
        subprocess.run([gsettings, "set", "org.gnome.shell", key,
                        str([u for u in current if u != uuid])],
                       check=True, stdin=subprocess.DEVNULL)
PY
}

restore_settings() {
    local state_file="$STATE_DIR/session.json"
    [[ -f "$state_file" ]] || return 0
    step "Restoring the settings an unfinished session changed"
    DWL_DRY_RUN="$DRY_RUN" python3 - "$state_file" "$GSETTINGS" <<'PY'
import json, os, subprocess, sys
dry = os.environ.get("DWL_DRY_RUN") == "1"
gsettings = sys.argv[2]
try:
    state = json.load(open(sys.argv[1]))
except (OSError, ValueError) as exc:
    print(f"  Could not read {sys.argv[1]}: {exc}")
    sys.exit(0)
for item in state.get("saved", []):
    if item["userValue"] is None:
        cmd = [gsettings, "reset", item["schema"], item["key"]]
    else:
        cmd = [gsettings, "set", item["schema"], item["key"], item["userValue"]]
    if dry:
        print("+ " + " ".join(cmd))
    else:
        subprocess.run(cmd, check=False, stdin=subprocess.DEVNULL)
PY
}

remove_browser_bridge() {
    step "Removing the browser bridge"
    run rm -f "$HOME_DIR/.config/google-chrome/NativeMessagingHosts/$HOST_NAME.json"
    run rm -f "$HOME_DIR/.mozilla/native-messaging-hosts/$HOST_NAME.json"
    "$GDBUS" call --session --dest org.freedesktop.impl.portal.PermissionStore \
        --object-path /org/freedesktop/impl/portal/PermissionStore \
        --method org.freedesktop.impl.portal.PermissionStore.DeletePermission \
        webextensions "$HOST_NAME" snap.firefox </dev/null >/dev/null 2>&1 || true
}

remove_browser_extension() {
    step "Removing the browser extension (asks for your password once)"
    if ! run "$SUDO" python3 "$POLICIES_PY" remove --etc "$ETC_DIR" \
        --chrome-id "$CHROME_ID" --gecko-id "$GECKO_ID" --chrome --firefox; then
        fail 1 "The GNOME extension is removed, but the browser policies could not be removed." \
            "Run the command again to retry this step (it needs your password). If it keeps failing, report it at https://github.com/$REPO/issues"
    fi
}

main() {
    WORK_DIR="$(mktemp -d)"
    trap 'rm -rf "$WORK_DIR"' EXIT
    get_policies_py
    remove_gnome_extension
    restore_settings
    remove_browser_bridge
    remove_browser_extension
    run rm -rf "$STATE_DIR"
    printf '\nDeep Work Lock is uninstalled. The browser extension disappears when you restart the browser.\n'
}

main "$@"
