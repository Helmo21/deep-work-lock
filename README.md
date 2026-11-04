# Deep Work Lock

A focus lock for GNOME: pick a duration and one target (a window, an app, or a Chrome or Firefox tab), and that is all you can see or use until the timer runs out.

Website: see `siteUrl` in [`release.json`](release.json) (the domain is set when the site goes live).

## Install

```bash
curl -fsSL <your-domain>/install.sh | bash
```

Replace `<your-domain>` with the `siteUrl` from `release.json`. The installer loads the GNOME Shell extension, then adds the Chrome and Firefox extensions through browser policies. To remove everything: `curl -fsSL <your-domain>/uninstall.sh | bash`.

Usage, behaviour choices and known limits are documented on the website, on the Docs page (source: `site/app/docs/page.tsx`).

Requirements: GNOME Shell 46 to 49 on X11, plus Google Chrome and/or Firefox (snap).

## Development

Layout:

- `gnome-extension/` : the GNOME Shell extension (desktop lock, menu, D-Bus service `org.deepworklock.Shell`). It bundles the native host and writes the browser manifests when enabled.
- `chrome-extension/` : the MV3 tab-lock extension, shared with Firefox.
- `native-host/` : the Python native-messaging host bridging the browsers and D-Bus.
- `scripts/` : build, signing, install and uninstall scripts.
- `site/` : the Next.js website (docs, privacy page, served install scripts).
- `tests/` : JS, gjs and Python tests.

Install a development build (builds, links the extension into `~/.local/share/gnome-shell/extensions/` and enables it):

```bash
scripts/dev-install.sh
```

On the first install you must log out and back in so GNOME Shell sees the new extension, then run `gnome-extensions enable deep-work-lock@helmo21.github.io`. The script also removes an old `deep-work-lock@deepwork.local` developer install and `~/.local/share/deep-work-lock/`.

Test and build:

```bash
npm test
npm run build
```

Warning: when testing in a nested `gnome-shell --nested`, export `GSETTINGS_BACKEND=memory`. Otherwise the lock writes your real session settings.

## Release

See [`docs/release.md`](docs/release.md).

## License

GPL-3.0-or-later. See [`LICENSE`](LICENSE).
