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
8. Deploy the site (Railway follows the `main` branch).
9. On a clean machine, check `curl -fsSL <siteUrl>/install.sh | bash`, then the uninstall command.
