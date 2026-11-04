#!/usr/bin/env bash
# Deep Work Lock installer, meant to be run as:
#   curl -fsSL <site>/install.sh | bash
#
# 1. checks the system, 2. hot-loads the GNOME extension from
# extensions.gnome.org over D-Bus (falls back to the GitHub Release zip),
# 3. writes the browser policies with a single sudo, 4. prints a summary.
#
# The whole body lives in main(), called on the last line, so a download cut
# short never runs half a script. Nothing reads stdin: under `curl | bash`
# stdin is the script itself.
#
# Every parameter can be overridden through a DWL_* variable (used by the
# tests). DWL_DRY_RUN=1 is a test knob: it prints each command that would
# change the system, prefixed with "+ ", instead of running it. gdbus and the
# detection commands still run in dry-run (the tests replace them with
# fakes), so never use DWL_DRY_RUN without a fake gdbus first in PATH.
# SPDX-License-Identifier: GPL-3.0-or-later
set -euo pipefail

SITE_URL="${DWL_SITE_URL:-https://example.invalid}"
UUID="${DWL_UUID:-deep-work-lock@helmo21.github.io}"
VERSION="${DWL_VERSION:-0.2.0}"
REPO="${DWL_REPO:-Helmo21/deep-work-lock}"
CHROME_ID="${DWL_CHROME_ID:-jegdmipkacdhhlldnopafmjhakdmddik}"
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
CHROME_CANDIDATES="${DWL_CHROME_CANDIDATES-google-chrome /opt/google/chrome/chrome}"
FIREFOX_CANDIDATES="${DWL_FIREFOX_CANDIDATES-firefox /snap/bin/firefox /opt/firefox/firefox}"
SNAP_FIREFOX="${DWL_SNAP_FIREFOX:-/snap/bin/firefox}"
# UUID of the old developer install (scripts/dev-install.sh before 0.2.0).
OLD_DEV_UUID="deep-work-lock@deepwork.local"

SHELL_EXTENSIONS=(--session --dest org.gnome.Shell.Extensions
    --object-path /org/gnome/Shell/Extensions)

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

# A browser counts as present when one of its candidates exists: a bare name
# is looked up in PATH, an absolute path must be executable.
has_browser() {
    local candidate
    for candidate in $1; do
        if [[ "$candidate" == /* ]]; then
            [[ -x "$candidate" ]] && return 0
        elif command -v "$candidate" >/dev/null 2>&1; then
            return 0
        fi
    done
    return 1
}

shell_call() {
    "$GDBUS" call "${SHELL_EXTENSIONS[@]}" "$@" </dev/null 2>&1 || true
}

# Sets EXT_STATE (integer, empty when GNOME Shell does not know the
# extension yet) and EXT_ERROR from GetExtensionInfo.
read_extension_state() {
    local info
    info="$(shell_call --method org.gnome.Shell.Extensions.GetExtensionInfo "$UUID")"
    EXT_STATE="$(sed -n "s/.*'state': <\([0-9]*\)\(\.[0-9]*\)\{0,1\}>.*/\1/p" <<<"$info")"
    EXT_ERROR="$(sed -n "s/.*'error': <'\([^']*\)'>.*/\1/p" <<<"$info")"
}

# GNOME Shell extension states: 1 ACTIVE, 2 INACTIVE, 3 ERROR,
# 4 OUT_OF_DATE, 5 DOWNLOADING, 6 INITIALIZED, 7 DEACTIVATING,
# 8 ACTIVATING, 99 UNINSTALLED.
# Returns 0 when active, 1 when still on its way (unknown, 5, 6, 8) after
# 15 s; fails the script on any other state.
wait_until_active() {
    local i
    for ((i = 0; i < 15; i++)); do
        read_extension_state
        case "$EXT_STATE" in
            1) return 0 ;;
            3 | 4) break ;;
        esac
        sleep 1
    done
    case "$EXT_STATE" in
        "" | 5 | 6 | 8) return 1 ;;
    esac
    local why="state $EXT_STATE"
    case "$EXT_STATE" in
        2) why="it stayed turned off; check that extensions are allowed in the Extensions app" ;;
        3) why="it reported an error${EXT_ERROR:+: $EXT_ERROR}" ;;
        4) why="it does not support this GNOME Shell version" ;;
    esac
    fail 1 "GNOME installed the extension but could not start it ($why)." \
        "The browser extension was not set up. Report the problem at https://github.com/$REPO/issues (include the output of: $GNOME_EXTENSIONS info $UUID)"
}

# Adds the UUID to enabled-extensions and removes it from
# disabled-extensions, which wins over enabled-extensions in GNOME Shell.
enable_in_gsettings() {
    if [[ "$DRY_RUN" == "1" ]]; then
        printf '+ %s: add %s to org.gnome.shell enabled-extensions, remove it from disabled-extensions\n' "$GSETTINGS" "$UUID"
        return 0
    fi
    python3 - "$GSETTINGS" "$UUID" <<'PY'
import ast, subprocess, sys
gsettings, uuid = sys.argv[1], sys.argv[2]

def get(key):
    raw = subprocess.run([gsettings, "get", "org.gnome.shell", key], check=True,
                         capture_output=True, text=True, stdin=subprocess.DEVNULL).stdout.strip()
    if raw.startswith("@as "):
        raw = raw[4:]
    return list(ast.literal_eval(raw)) if raw else []

def put(key, value):
    subprocess.run([gsettings, "set", "org.gnome.shell", key, str(value)], check=True,
                   stdin=subprocess.DEVNULL)

disabled = get("disabled-extensions")
if uuid in disabled:
    put("disabled-extensions", [u for u in disabled if u != uuid])
enabled = get("enabled-extensions")
if uuid not in enabled:
    put("enabled-extensions", enabled + [uuid])
PY
}

install_from_release() {
    local zip_url="https://github.com/$REPO/releases/download/v$VERSION/$UUID.shell-extension.zip"
    local zip="$WORK_DIR/$UUID.shell-extension.zip"
    say "extensions.gnome.org could not install it; using the GitHub release instead."
    if ! run "$CURL" -fsSL -o "$zip" "$zip_url"; then
        fail 1 "Deep Work Lock could not download $zip_url" \
            "Nothing was changed. Check your connection and run the command again."
    fi
    if ! run "$GNOME_EXTENSIONS" install --force "$zip"; then
        fail 1 "Deep Work Lock could not install the GNOME extension from $zip_url" \
            "Nothing else was changed. Run the command again, or report the problem at https://github.com/$REPO/issues"
    fi
    if ! enable_in_gsettings; then
        fail 1 "The GNOME extension is installed but could not be turned on." \
            "Turn it on with: $GNOME_EXTENSIONS enable $UUID (after logging out and back in), then run the command again."
    fi
    FALLBACK=1
}

check_system() {
    step "Checking your system"
    if [[ "$(id -u)" == "0" ]]; then
        fail 1 "Deep Work Lock installs for your own account: run the command as your normal user, not as root." \
            "Nothing was changed."
    fi
    local marker="@""@"  # split so that publishing does not substitute it away
    local value
    for value in "$SITE_URL" "$UUID" "$VERSION" "$REPO" "$CHROME_ID" "$GECKO_ID" "$HOST_NAME"; do
        [[ "$value" == *"$marker"* ]] || continue
        fail 1 "This copy of install.sh was not prepared for publishing." \
            "Nothing was changed. Use the install command shown on the Deep Work Lock website."
    done

    local version major
    if ! command -v gnome-shell >/dev/null 2>&1; then
        fail 1 "Deep Work Lock needs GNOME Shell 46 to 49, and GNOME Shell was not found." \
            "Nothing was changed."
    fi
    version="$(gnome-shell --version </dev/null 2>/dev/null || true)"
    major="$(sed -n 's/^GNOME Shell \([0-9][0-9]*\).*/\1/p' <<<"$version")"
    if [[ -z "$major" || "$major" -lt 46 || "$major" -gt 49 ]]; then
        fail 1 "Deep Work Lock needs GNOME Shell 46 to 49 (found: ${version:-unknown})." \
            "Nothing was changed."
    fi
    if ! command -v python3 >/dev/null 2>&1; then
        fail 1 "Deep Work Lock needs python3. Install it (for example: apt install python3), then run the command again." \
            "Nothing was changed."
    fi
    if ! python3 -c 'import gi' </dev/null >/dev/null 2>&1; then
        fail 1 "Deep Work Lock needs the Python GObject bindings. Install them (for example: apt install python3-gi), then run the command again." \
            "Nothing was changed."
    fi
    if ! command -v "$GDBUS" >/dev/null 2>&1; then
        fail 1 "Deep Work Lock needs gdbus. Install it (for example: apt install libglib2.0-bin), then run the command again." \
            "Nothing was changed."
    fi

    CHROME=0
    FIREFOX=0
    has_browser "$CHROME_CANDIDATES" && CHROME=1
    has_browser "$FIREFOX_CANDIDATES" && FIREFOX=1
    if [[ "$CHROME" == "0" && "$FIREFOX" == "0" ]]; then
        fail 1 "Deep Work Lock needs Google Chrome or Firefox, and neither was found." \
            "Nothing was changed. Install one of them, then run the command again."
    fi
    if ! command -v "$SUDO" >/dev/null 2>&1; then
        fail 1 "Deep Work Lock needs $SUDO to set up the browser extension, and it was not found." \
            "Nothing was changed. Install it (or ask your administrator), then run the command again."
    fi

    if [[ -n "${DWL_POLICIES_PY:-}" ]]; then
        POLICIES_PY="$DWL_POLICIES_PY"
    else
        POLICIES_PY="$WORK_DIR/policies.py"
        if ! run "$CURL" -fsSL -o "$POLICIES_PY" "$SITE_URL/policies.py"; then
            fail 1 "Deep Work Lock could not download $SITE_URL/policies.py" \
                "Nothing was changed. Check your connection and run the command again."
        fi
    fi
}

install_gnome_extension() {
    step "Installing the GNOME extension from extensions.gnome.org"
    FALLBACK=0
    local result=""
    if [[ -f "$HOME_DIR/.local/share/gnome-shell/extensions/$UUID/metadata.json" ]]; then
        result="$(shell_call --method org.gnome.Shell.Extensions.EnableExtension "$UUID")"
        if [[ "$result" == *true* ]]; then
            say "Already installed: turned it on."
            result="'successful'"
        else
            result=""
        fi
    fi
    if [[ -z "$result" ]]; then
        say "Confirm the GNOME dialog that opens now."
        # The call blocks until the dialog is answered.
        result="$(shell_call --timeout 600 \
            --method org.gnome.Shell.Extensions.InstallRemoteExtension "$UUID")"
    fi

    case "$result" in
        *"'cancelled'"*)
            fail 2 "You cancelled the GNOME dialog. Run the command again when you are ready." \
                "Nothing else was changed."
            ;;
        *"Timeout was reached"* | *TimedOut* | *NoReply*)
            fail 2 "No answer from the GNOME dialog. Run the command again." \
                "Nothing else was changed."
            ;;
        *"'successful'"*)
            if ! wait_until_active; then
                say "GNOME installed the extension but has not started it yet."
                FALLBACK=1
            fi
            ;;
        *)
            install_from_release
            ;;
    esac

    if [[ "$FALLBACK" == "0" ]]; then
        local manifest="$HOME_DIR/.config/google-chrome/NativeMessagingHosts/$HOST_NAME.json"
        local i
        for ((i = 0; i < 5; i++)); do
            [[ -f "$manifest" ]] && break
            sleep 1
        done
        if [[ ! -f "$manifest" ]]; then
            fail 1 "The GNOME extension is running but did not connect itself to the browsers ($manifest is missing)." \
                "Log out and back in, then run the command again. If it keeps failing, report it at https://github.com/$REPO/issues"
        fi
    fi
}

# An old developer install competes with this one for the same D-Bus name.
# The public script only reports it: removing it is the user's call.
warn_old_dev_install() {
    local old="$HOME_DIR/.local/share/gnome-shell/extensions/$OLD_DEV_UUID"
    [[ -e "$old" || -L "$old" ]] || return 0
    say "Warning: an old developer copy of Deep Work Lock is installed in $old."
    say "It competes with this one for the same D-Bus name. Remove it with:"
    say "  $GNOME_EXTENSIONS uninstall $OLD_DEV_UUID   (or: rm -rf '$old')"
    say "then log out and back in."
}

# Firefox in a snap asks the WebExtensions portal before starting the host,
# and a dialog left unanswered is stored as a refusal. The extension grants
# it on enable, but enable() does not run again for an extension that is
# already on, nor when snap Firefox arrives later: grant it here as well.
grant_snap_firefox() {
    [[ "$FIREFOX" == "1" && -x "$SNAP_FIREFOX" ]] || return 0
    if "$GDBUS" call --session --dest org.freedesktop.impl.portal.PermissionStore \
        --object-path /org/freedesktop/impl/portal/PermissionStore \
        --method org.freedesktop.impl.portal.PermissionStore.SetPermission \
        webextensions true "$HOST_NAME" snap.firefox "['yes']" </dev/null >/dev/null 2>&1; then
        say "Allowed snap Firefox to start the Deep Work Lock host."
    else
        say "Could not pre-allow snap Firefox; if Firefox asks, allow Deep Work Lock."
    fi
}

install_browser_extension() {
    step "Installing the browser extension (asks for your password once)"
    local args=(install --etc "$ETC_DIR" --chrome-id "$CHROME_ID" --gecko-id "$GECKO_ID"
        --install-url "$SITE_URL/releases/deep-work-lock-latest.xpi")
    [[ "$CHROME" == "1" ]] && args+=(--chrome)
    [[ "$FIREFOX" == "1" ]] && args+=(--firefox)
    if ! run "$SUDO" python3 "$POLICIES_PY" "${args[@]}"; then
        fail 1 "The GNOME extension is installed, but the browser extension could not be set up." \
            "Run the command again to retry this step (it needs your password)."
    fi
}

summary() {
    local browsers
    if [[ "$CHROME" == "1" && "$FIREFOX" == "1" ]]; then
        browsers="Chrome and Firefox"
    elif [[ "$CHROME" == "1" ]]; then
        browsers="Chrome"
    else
        browsers="Firefox"
    fi
    printf '\nDeep Work Lock is installed:\n'
    if [[ "$FALLBACK" == "1" ]]; then
        say "• GNOME extension $UUID (starts after you log back in)"
    else
        say "• GNOME extension $UUID (running)"
    fi
    say "• browser extension for $browsers"
    printf '\nRestart %s to see the extension.\n' "$browsers"
    if [[ "$FALLBACK" == "1" ]]; then
        printf 'Log out and back in to finish, then click ◉ Focus in the top bar.\n'
    else
        printf 'Click ◉ Focus in the top bar.\n'
    fi
}

main() {
    WORK_DIR="$(mktemp -d)"
    trap 'rm -rf "$WORK_DIR"' EXIT
    check_system
    warn_old_dev_install
    install_gnome_extension
    grant_snap_firefox
    install_browser_extension
    summary
}

main "$@"
