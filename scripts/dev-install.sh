#!/usr/bin/env bash
# Developer install, without extensions.gnome.org nor the browser stores:
# builds the repository, links the built GNOME extension into
# ~/.local/share/gnome-shell/extensions and turns it on. The extension
# writes the Chrome and Firefox native-messaging manifests itself when it is
# enabled. Load the browser extensions by hand (printed at the end).
# SPDX-License-Identifier: GPL-3.0-or-later
set -euo pipefail

ROOT="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
UUID="deep-work-lock@helmo21.github.io"
OLD_UUID="deep-work-lock@deepwork.local"
EXTENSIONS_DIR="$HOME/.local/share/gnome-shell/extensions"
LINK="$EXTENSIONS_DIR/$UUID"
TARGET="$ROOT/build/gnome/$UUID"

step() { printf '→ %s\n' "$*"; }

main() {
    step "Building"
    (cd "$ROOT" && npm run build) </dev/null

    step "Removing the previous developer install ($OLD_UUID)"
    gnome-extensions disable "$OLD_UUID" </dev/null 2>/dev/null || true
    rm -rf "${EXTENSIONS_DIR:?}/$OLD_UUID" "$HOME/.local/share/deep-work-lock"

    step "Linking $LINK → $TARGET"
    mkdir -p "$EXTENSIONS_DIR"
    if [[ -e "$LINK" && ! -L "$LINK" ]]; then
        echo "  Replacing the copy installed from extensions.gnome.org or a release zip."
        rm -rf "$LINK"
    fi
    ln -sfn "$TARGET" "$LINK"

    step "Turning on the GNOME extension"
    if gnome-extensions enable "$UUID" </dev/null 2>/dev/null; then
        echo "  Enabled."
    else
        echo "  GNOME Shell only discovers a new extension at login (first install):"
        echo "  log out and back in, then run: gnome-extensions enable $UUID"
    fi

    cat <<TXT

Then load the browser extensions:

  Chrome: chrome://extensions → turn on Developer mode → Load unpacked →
          $ROOT/build/chrome
  Firefox (temporary, removed when Firefox closes):
          about:debugging#/runtime/this-firefox → Load Temporary Add-on… →
          $ROOT/build/firefox/manifest.json

After a change, run this script again, then reload the browser extension.
GNOME Shell reloads extension code only at login (X11: Alt+F2, r, Enter).
TXT
}

main "$@"
