#!/usr/bin/env bash
# Builds the Firefox extension and has Mozilla sign it as "unlisted" (not
# published on addons.mozilla.org). Keys come from the environment, never
# from the repository:
#   WEB_EXT_API_KEY=user:… WEB_EXT_API_SECRET=… scripts/sign-firefox.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
: "${WEB_EXT_API_KEY:?WEB_EXT_API_KEY is not set (addons.mozilla.org > Tools > Manage API Keys)}"
: "${WEB_EXT_API_SECRET:?WEB_EXT_API_SECRET is not set}"

SITE_URL="$(node -p "JSON.parse(require('fs').readFileSync('$ROOT/release.json','utf8')).siteUrl")"
VERSION="$(node -p "JSON.parse(require('fs').readFileSync('$ROOT/release.json','utf8')).version")"
PLACEHOLDER="$(node --input-type=module -e "import {PLACEHOLDER_SITE_URL} from '$ROOT/scripts/release-config.mjs'; console.log(PLACEHOLDER_SITE_URL)")"
if [ "$SITE_URL" = "$PLACEHOLDER" ]; then
    echo "Refusing to sign: siteUrl in release.json is still the placeholder ($SITE_URL)." >&2
    echo "The signed add-on embeds update_url, so set the real site URL first." >&2
    exit 1
fi

node "$ROOT/scripts/build-firefox.mjs" "$ROOT/build/firefox"
npx --yes web-ext@10.7.0 sign \
    --channel unlisted \
    --source-dir "$ROOT/build/firefox" \
    --artifacts-dir "$ROOT/web-ext-artifacts"

# web-ext names the signed file <slug>-<version>.xpi; older runs may have left
# other versions next to it, so pick this version's file, not the newest one.
shopt -s nullglob
MATCHES=("$ROOT"/web-ext-artifacts/*-"$VERSION".xpi)
shopt -u nullglob
if [ "${#MATCHES[@]}" -ne 1 ]; then
    echo "Expected exactly one signed web-ext-artifacts/*-$VERSION.xpi, found ${#MATCHES[@]}." >&2
    exit 1
fi
XPI="${MATCHES[0]}"
mkdir -p "$ROOT/site/public/releases"
cp "$XPI" "$ROOT/site/public/releases/deep-work-lock-$VERSION.xpi"
cp "$XPI" "$ROOT/site/public/releases/deep-work-lock-latest.xpi"

echo
echo "Signed extension: $XPI"
echo "Copied to site/public/releases/deep-work-lock-$VERSION.xpi and deep-work-lock-latest.xpi"
