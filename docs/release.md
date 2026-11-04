# Release procedure

Preconditions (first release only): the domain is chosen and `siteUrl` in `release.json` is set to it, the repository is public, and `LICENSE` (GPL-3.0-or-later) is committed. Do this before the first store submission: both stores expect a public source and a licence.

1. Update `release.json` and the three other versions (`package.json`, `chrome-extension/manifest.json`, `version-name` in `gnome-extension/deep-work-lock@helmo21.github.io/metadata.json`). `npm test` checks that they agree.
2. Build: `npm run build`. This produces:
   - `build/gnome/deep-work-lock@helmo21.github.io.shell-extension.zip`
   - `build/deep-work-lock-chrome-<version>.zip`
   - `build/firefox/` (unsigned, input of the signing step)
3. Sign the Firefox extension (unlisted). The script reads `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET` from the environment; they live in the git-ignored `.env`:
   ```bash
   set -a; . ./.env; set +a
   scripts/sign-firefox.sh
   ```
   It refuses to run while `siteUrl` is still the placeholder, because the signed add-on embeds `update_url`. It writes `site/public/releases/deep-work-lock-<version>.xpi` and `deep-work-lock-latest.xpi`.
4. `npm run prepare-site`, then commit the files under `site/public/` (including the signed `.xpi`).
5. Tag `v<version>` and create the GitHub Release with these three files attached: the GNOME zip, `deep-work-lock-chrome-<version>.zip`, and the signed `.xpi`.
6. Upload the GNOME zip to extensions.gnome.org, using the text in [`store/extensions-gnome-org.md`](store/extensions-gnome-org.md).
7. Upload the Chrome zip to the Chrome Web Store, using the text in [`store/chrome-web-store.md`](store/chrome-web-store.md).
   - If the upload is refused because the manifest contains `key`, rebuild the zip without it: `node scripts/build-chrome.mjs --store` (or `DWL_CHROME_STORE=1`); the default build keeps `key` so that dev builds share the store id.
8. **Gate before deploying (first upload):** compare the extension id the Chrome Web Store assigned (developer dashboard, item page) with `chromeExtensionId` in `release.json`. The policies installed by `install.sh` pin that id, so a mismatch means Chrome installs nothing.
   - Same id: go on.
   - Different id (the store ignored `key`, or the zip had none): set `chromeExtensionId` in `release.json` to the assigned id, update `CHROME_EXTENSION_ID` in `gnome-extension/deep-work-lock@helmo21.github.io/lib/constants.js` (the native-host manifest's `allowed_origins`), and replace `key` in `chrome-extension/manifest.json` with the store's public key (dashboard, Package > View public key) so that dev builds keep the same id — `npm test` checks that `key`, `release.json` and `constants.js` agree (also update the expected id in `tests/release.test.mjs`). Then `npm run prepare-site`, commit, and publish a new GNOME extension version so installed hosts accept the new origin.
9. Deploy the site (Railway follows the `main` branch).
10. On a clean machine, check `curl -fsSL <siteUrl>/install.sh | bash`, then the uninstall command. If the test machine had a developer install, the installer warns about `~/.local/share/gnome-shell/extensions/deep-work-lock@deepwork.local`: remove it first (`gnome-extensions uninstall deep-work-lock@deepwork.local`, or run `scripts/dev-install.sh`, which replaces it), because both compete for the same D-Bus name.
