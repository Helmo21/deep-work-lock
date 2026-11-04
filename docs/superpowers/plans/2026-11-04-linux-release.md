# Deep Work Lock — première sortie publique Linux — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre Deep Work Lock installable par n'importe qui sous GNOME 46–49 (X11 et Wayland) avec une seule commande copiée depuis un site en anglais, sans manipulation dans le navigateur ni déconnexion, et prêt à être soumis à extensions.gnome.org et au Chrome Web Store.

**Architecture:** L'extension GNOME embarque le pont Python et écrit elle-même les manifestes de messagerie native à l'activation (modèle GSConnect). Le script public `install.sh` charge l'extension GNOME à chaud depuis extensions.gnome.org par D-Bus, puis écrit des politiques navigateur `normal_installed` (Chrome : Web Store ; Firefox : `.xpi` signé auto-hébergé) avec un seul `sudo`. Un site Next.js (template `modern-cli-tool-landing-page/`, déplacé en `site/`) hébergé sur Railway présente le produit et sert `install.sh`, `uninstall.sh`, les `.xpi` et `updates.json`. Un fichier `release.json` à la racine est la source unique de la version, du domaine, de l'UUID et des identifiants d'extension.

**Tech Stack:** GJS / GNOME Shell 46–49 (ESM), Python 3 + PyGObject (pont et politiques), WebExtensions MV3 (Chrome + Firefox), bash + python3 (scripts), Node 24 (`node --test`, scripts de build, `sharp` pour les icônes), Next.js + Tailwind + shadcn/ui + pnpm (site), Railway (hébergement), `web-ext` (signature Firefox).

**Spec:** `docs/superpowers/specs/2026-11-04-linux-release-design.md` (et, pour tout ce qu'elle ne change pas, `2026-11-01-deep-work-lock-design.md` et `2026-11-02-firefox-tab-lock-design.md`).

## Global Constraints

- Version publique unique **0.2.0** dans `release.json`, `package.json`, `chrome-extension/manifest.json` et `metadata.json` (`version-name`) ; 0.1.0 est consommée côté Mozilla.
- UUID GNOME : **`deep-work-lock@helmo21.github.io`** (dossier, `metadata.json`, scripts). Identifiant Firefox inchangé : **`deep-work-lock@deepwork.local`**. Identifiant Chrome (dérivé de `key`, ne change pas) : **`jegdmipkacdhhlldnopafmjhakdmddik`**. Nom d'hôte natif inchangé : **`org.deepworklock.host`**. Noms D-Bus inchangés (`org.deepworklock.Shell`, `…ChromeBridge`, `…FirefoxBridge`).
- `metadata.json` : `"shell-version": ["46", "47", "48", "49"]`, `"url": "https://github.com/Helmo21/deep-work-lock"`, `"session-modes": ["user", "unlock-dialog"]` conservé.
- Le domaine n'est pas connu : `release.json` porte `"siteUrl": "https://example.invalid"` jusqu'à ce que l'auteur le donne ; **aucune autre copie littérale du domaine** dans le code, les scripts et le site : tout passe par `release.json` ou par la substitution de `prepare-site.mjs` (les tests comparent les fichiers générés aux fichiers committés). Le `.xpi` ne se signe pas tant que `siteUrl` vaut la valeur de remplacement.
- Toute chaîne visible par l'utilisateur (menu GNOME, OSD, notification, descriptions de manifestes, sortie des scripts, site, README) est **en anglais**.
- Politiques navigateur en mode **`normal_installed`** uniquement. Chrome : `/etc/opt/chrome/policies/managed/deep-work-lock.json`. Firefox : fusion dans `/etc/firefox/policies/policies.json`, jamais d'écrasement.
- Chargement à chaud GNOME par `org.gnome.Shell.Extensions.InstallRemoteExtension` ; le repli (zip de la GitHub Release + « log out and back in ») n'est utilisé qu'en cas d'échec.
- Licence **GPL-3.0-or-later** pour tout le dépôt.
- Pas de code minifié, pas de binaire dans l'extension GNOME ; le pont Python reste un script source.
- Commits petits et fréquents ; `npm test` vert à la fin de chaque tâche.

## Review Focus

1. **`/etc/firefox/policies/policies.json` existe déjà avec d'autres politiques** (poste d'entreprise, autre outil) : l'installation doit ajouter notre entrée et conserver tout le reste ; la désinstallation doit retirer notre seule entrée et laisser le fichier sinon. Test dans la tâche 7.
2. **La commande est relancée** (deuxième essai, mise à jour) : même état final, aucune duplication, aucun échec. Test dans la tâche 8 (double exécution à blanc) et tâche 5 (manifestes réécrits à l'identique).
3. **Un seul navigateur est installé** (Chrome sans Firefox, ou l'inverse) : seule la politique correspondante est écrite, le bilan ne parle pas de l'autre. Test dans la tâche 8.
4. **La personne clique « Cancel » dans la boîte GNOME** : le script s'arrête avec un message clair, sans `sudo`, sans repli silencieux. Test dans la tâche 8.
5. **Des manifestes de l'ancienne installation développeur existent** (pointant vers `~/.local/share/deep-work-lock/`) : l'extension les remplace par les siens à l'activation. Test dans la tâche 5.

## Structure des fichiers

```
release.json                         source unique : version, siteUrl, repo, uuid, ids, hostName
LICENSE                              GPL-3.0-or-later
package.json                         version 0.2.0 ; scripts test/build ; devDependency sharp
scripts/
  release-config.mjs                 lit release.json ; chromeExtensionIdOf(key)
  build-gnome.mjs                    build/gnome/<uuid>/ + <uuid>.shell-extension.zip (avec native-host/)
  build-chrome.mjs                   build/chrome/ + build/deep-work-lock-chrome-<v>.zip
  build-firefox.mjs                  (existant) + update_url + icons
  sign-firefox.sh                    (existant) + copie vers site/public/releases/
  render-icons.mjs                   assets/icon.svg -> chrome-extension/icons/icon-{16,48,128}.png
  policies.py                        politiques Chrome/Firefox : construire, fusionner, retirer ; CLI
  test_policies.py                   tests unittest de policies.py
  install.sh                         script public (servi à /install.sh après substitution)
  uninstall.sh                       script public
  dev-install.sh                     installation locale pour développer (remplace ./install.sh)
  prepare-site.mjs                   génère site/release.json, site/public/install.sh|uninstall.sh|updates.json
assets/icon.svg
gnome-extension/deep-work-lock@helmo21.github.io/
  metadata.json, extension.js, stylesheet.css
  lib/constants.js                   CHROME_EXTENSION_ID, GECKO_ID, HOST_NAME
  lib/hostManifests.js               pur : contenu et chemins des manifestes
  lib/hostSetup.js                   écrit les manifestes, chmod, portail snap
  lib/policy.js, panel.js, stateStore.js, windowGuard.js …  (existants, modifiés)
native-host/deep_work_lock_host.py   (existant ; copié dans l'extension au build)
chrome-extension/                    (existant) + icons/
tests/
  release.test.mjs                   cohérence release.json / versions / ids / uuid
  host-manifests.test.mjs            hostManifests.js
  install-script.test.mjs            install.sh / uninstall.sh à blanc avec des faux gdbus/sudo
  build.test.mjs                     build-gnome / build-chrome / prepare-site
  gjs/host-setup.test.js             hostSetup.js dans un HOME temporaire
  policy.test.mjs, firefox-manifest.test.mjs … (existants, modifiés)
site/                                ancien modern-cli-tool-landing-page/
  app/page.tsx, app/docs/page.tsx, app/privacy/page.tsx, app/layout.tsx
  lib/site-config.ts                 lit site/release.json
  public/install.sh, uninstall.sh, updates.json, releases/*.xpi   (générés / copiés)
docs/release.md                      procédure de sortie
docs/store/chrome-web-store.md, docs/store/extensions-gnome-org.md
README.md                            en anglais
```

---

### Task 1 : Fondations — licence, `release.json`, version 0.2.0

**Files:**
- Create: `LICENSE`, `release.json`, `scripts/release-config.mjs`, `tests/release.test.mjs`
- Modify: `package.json`, `chrome-extension/manifest.json` (version), `gnome-extension/deep-work-lock@deepwork.local/metadata.json` (ajout `version-name`), `.gitignore`
- Commit: `docs/superpowers/specs/2026-11-04-linux-release-design.md`, ce plan

**Interfaces:**
- Produces: `release.json` = `{"version": "0.2.0", "siteUrl": "https://example.invalid", "repo": "Helmo21/deep-work-lock", "uuid": "deep-work-lock@helmo21.github.io", "chromeExtensionId": "jegdmipkacdhhlldnopafmjhakdmddik", "geckoId": "deep-work-lock@deepwork.local", "hostName": "org.deepworklock.host"}`.
- Produces: `scripts/release-config.mjs` : `export const RELEASE` (l'objet ci-dessus), `export const PLACEHOLDER_SITE_URL = 'https://example.invalid'`, `export function chromeExtensionIdOf(keyBase64: string): string` (sha256 de la clé décodée, 32 premiers hexas, chaque chiffre hexa → lettre `a`–`p`), `export function extensionDir(root: string): string` → `gnome-extension/<uuid>`.

- [ ] **Step 1 : Écrire le test**

```js
// tests/release.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {RELEASE, PLACEHOLDER_SITE_URL, chromeExtensionIdOf, extensionDir} from '../scripts/release-config.mjs';

const json = p => JSON.parse(readFileSync(p, 'utf8'));

test('one version everywhere', () => {
    assert.equal(RELEASE.version, '0.2.0');
    assert.equal(json('package.json').version, RELEASE.version);
    assert.equal(json('chrome-extension/manifest.json').version, RELEASE.version);
    assert.equal(json(`${extensionDir('.')}/metadata.json`)['version-name'], RELEASE.version);
});

test('chrome extension id derives from the manifest key', () => {
    assert.equal(chromeExtensionIdOf(json('chrome-extension/manifest.json').key), 'jegdmipkacdhhlldnopafmjhakdmddik');
    assert.equal(RELEASE.chromeExtensionId, 'jegdmipkacdhhlldnopafmjhakdmddik');
});

test('ids and uuid', () => {
    assert.equal(RELEASE.geckoId, 'deep-work-lock@deepwork.local');
    assert.equal(RELEASE.hostName, 'org.deepworklock.host');
    assert.equal(RELEASE.uuid, 'deep-work-lock@helmo21.github.io');
    assert.ok(existsSync(extensionDir('.')), 'extension directory is named after the uuid');
});

test('site url is https and the placeholder is recognisable', () => {
    assert.match(RELEASE.siteUrl, /^https:\/\/[^/]+$/);
    assert.equal(PLACEHOLDER_SITE_URL, 'https://example.invalid');
});

test('license', () => {
    assert.match(readFileSync('LICENSE', 'utf8'), /GNU GENERAL PUBLIC LICENSE\s+Version 3/);
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `node --test tests/release.test.mjs`
Expected: FAIL (`release-config.mjs` introuvable).

- [ ] **Step 3 : Créer `release.json`, `scripts/release-config.mjs`, `LICENSE` (texte officiel GPL-3.0), passer les versions à 0.2.0, ajouter `"version-name": "0.2.0"` dans `metadata.json`**

Le test `ids and uuid` restera rouge sur `existsSync` jusqu'à la tâche 3 : marquer ce `assert.ok` avec `{skip: 'task 3'}` via un `test(..., {todo: true})` séparé, puis le réactiver dans la tâche 3.

- [ ] **Step 4 : `.gitignore`** : ajouter `site/node_modules/`, `site/.next/`, `site/out/`, `*.tsbuildinfo`, `next-env.d.ts`.

- [ ] **Step 5 : Lancer les tests**

Run: `npm test`
Expected: PASS (le test `todo` est signalé, pas en échec).

- [ ] **Step 6 : Commit**

```bash
git add LICENSE release.json scripts/release-config.mjs tests/release.test.mjs package.json chrome-extension/manifest.json gnome-extension/*/metadata.json .gitignore docs/superpowers/specs/2026-11-04-linux-release-design.md docs/superpowers/plans/2026-11-04-linux-release.md
git commit -m "chore: release config, GPL-3.0 license, version 0.2.0"
```

---

### Task 2 : Le produit parle anglais

**Files:**
- Modify: `gnome-extension/*/lib/policy.js` (`lockMessage`), `lib/panel.js`, `extension.js`, `metadata.json` (description), `chrome-extension/manifest.json` (description), `native-host/deep_work_lock_host.py` (messages déjà en anglais : vérifier), `tests/policy.test.mjs`

**Interfaces:**
- Produces: chaînes exactes ci-dessous, utilisées par les tests et par la documentation.

- [ ] **Step 1 : Modifier le test `lockMessage`** dans `tests/policy.test.mjs`

```js
assert.equal(lockMessage(754000), '🔒 Locked · 12:34 left');
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `node --test tests/policy.test.mjs`
Expected: FAIL sur `lockMessage`.

- [ ] **Step 3 : Remplacer les chaînes**

| Où | Avant | Après |
|---|---|---|
| `policy.js` `lockMessage` | `🔒 Verrouillé · ${t} restantes` | `🔒 Locked · ${t} left` |
| `panel.js` en-têtes | `DURÉE`, `CIBLE` | `DURATION`, `TARGET` |
| `panel.js` bouton | `Verrouiller ${m} min` / `Durée invalide (1–600)` | `Lock for ${m} min` / `Invalid duration (1–600)` |
| `panel.js` `kindLabel` | `fenêtre`, `onglet`, `app` | `window`, `tab`, `app` |
| `panel.js` | `Toute la fenêtre` | `Whole window` |
| `panel.js` | `${n} onglet(s)` | `${n} tab` / `${n} tabs` |
| `panel.js` indice | `Extension ${name} non connectée : onglets indisponibles` | `${name} extension not connected: tabs unavailable` |
| `extension.js` OSD | `${name} injoignable : verrou limité à la fenêtre` | `${name} unreachable: lock limited to the window` |
| `extension.js` son | `Session Deep Work terminée` | `Deep Work session finished` |
| `metadata.json` description | — | `Locks the screen on one window, app or browser tab until the timer runs out. Runs in the unlock dialog so the lock survives the lock screen.` |
| `chrome-extension/manifest.json` description | — | `Locks one tab during a Deep Work Lock session (driven by the GNOME extension).` |

`console.log` et commentaires : laisser tels quels s'ils sont déjà en anglais.

- [ ] **Step 4 : Lancer les tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5 : Vérifier qu'il ne reste pas de français visible**

Run: `grep -rnE "[éèàçùê]" gnome-extension chrome-extension native-host/deep_work_lock_host.py | grep -vE "^\S+:\s*//|^\S+:\s*\*|^\S+:\s*#"`
Expected: aucune ligne qui soit une chaîne affichée (les commentaires peuvent rester).

- [ ] **Step 6 : Commit** — `git commit -am "feat: english user-facing strings"`

---

### Task 3 : UUID, métadonnées extensions.gnome.org, version dans le menu

**Files:**
- Rename: `gnome-extension/deep-work-lock@deepwork.local/` → `gnome-extension/deep-work-lock@helmo21.github.io/` (`git mv`)
- Modify: `metadata.json`, `lib/panel.js`, `extension.js`, `tests/gjs/settings.test.js` (chemin d'import), `tests/release.test.mjs` (réactiver le test), `install.sh`, `uninstall.sh` (UUID, provisoirement : ces scripts sont remplacés en tâche 8)

**Interfaces:**
- Produces: `FocusIndicator` accepte `versionName: string` dans son constructeur et affiche en pied de menu `Deep Work Lock ${versionName}` (élément non réactif, classe `dwl-footer`).

- [ ] **Step 1 : Réactiver dans `tests/release.test.mjs` le test sur le dossier de l'extension** (retirer le `todo`), et ajouter :

```js
test('metadata for extensions.gnome.org', () => {
    const m = json(`${extensionDir('.')}/metadata.json`);
    assert.equal(m.uuid, RELEASE.uuid);
    assert.deepEqual(m['shell-version'], ['46', '47', '48', '49']);
    assert.equal(m.url, 'https://github.com/Helmo21/deep-work-lock');
    assert.deepEqual(m['session-modes'], ['user', 'unlock-dialog']);
    assert.match(m.description, /unlock dialog/);
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec** — Run: `node --test tests/release.test.mjs` — Expected: FAIL (dossier et uuid).

- [ ] **Step 3 : `git mv` du dossier ; mettre `metadata.json` à jour ; corriger le chemin dans `tests/gjs/settings.test.js` et l'UUID dans `install.sh`/`uninstall.sh`**

- [ ] **Step 4 : Pied de menu** : dans `extension.js`, passer `versionName: this.metadata['version-name']` à `FocusIndicator` ; dans `panel.js`, après le bouton « Lock », ajouter `header(...)`-like item non réactif avec `St.Label({text: \`Deep Work Lock ${versionName}\`, style_class: 'dwl-footer'})` ; ajouter `.dwl-footer` (petit, gris) dans `stylesheet.css`.

- [ ] **Step 5 : Lancer les tests** — Run: `npm test` — Expected: PASS.

- [ ] **Step 6 : Vérifier à la main dans un Shell imbriqué** (banc d'essai, pas validation) :

Run: `GSETTINGS_BACKEND=memory MUTTER_DEBUG_DUMMY_MODE_SPECS=1600x900 dbus-run-session -- gnome-shell --nested --wayland` puis, avec le `DBUS_SESSION_BUS_ADDRESS` du processus imbriqué, `gnome-extensions enable deep-work-lock@helmo21.github.io` (l'extension doit d'abord être liée dans `~/.local/share/gnome-shell/extensions/` sous le nouveau nom, par `scripts/dev-install.sh` de la tâche 8 ou un lien symbolique provisoire).
Expected: le menu ◉ Focus s'ouvre, les en-têtes sont `DURATION` / `TARGET`, le pied affiche `Deep Work Lock 0.2.0`.

- [ ] **Step 7 : Commit** — `git commit -am "feat(gnome): uuid deep-work-lock@helmo21.github.io, e.g.o metadata, version in menu"`

---

### Task 4 : Wayland — reprise de session seulement dans le même Shell

**Files:**
- Modify: `lib/policy.js` (`decideStartup`), `lib/stateStore.js` (`currentShellInstance`), `extension.js` (`_lock`, `enable`), `lib/windowGuard.js` (commentaire de `windowId`), `tests/policy.test.mjs`

**Interfaces:**
- Produces: `decideStartup(state, env, nowMs)` avec `env = {bootId: string, shellInstance: string, wayland: boolean}` → `'none' | 'resume' | 'restore'`. Règles : pas d'état → `none` ; expiré ou `bootId` différent → `restore` ; `wayland && state.shellInstance !== env.shellInstance` → `restore` ; sinon `resume`.
- Produces: `currentShellInstance(): string` dans `stateStore.js` — `${pid}:${starttime}` lu dans `/proc/self/stat` (champ 22 après la parenthèse fermante), `'unknown'` en cas d'échec.
- L'état de session gagne `shellInstance: string` (écrit par `_lock`). Version de l'état inchangée (2) ; un fichier sans `shellInstance` donne `undefined !== env.shellInstance` → `restore` en Wayland, comportement voulu.

- [ ] **Step 1 : Remplacer le test `decideStartup`**

```js
test('decideStartup', () => {
    const x11 = {bootId: 'B1', shellInstance: 'S1', wayland: false};
    const wl = {bootId: 'B1', shellInstance: 'S1', wayland: true};
    assert.equal(decideStartup(null, x11, 0), 'none');
    assert.equal(decideStartup({bootId: 'B1', endsAt: 1000, shellInstance: 'S0'}, x11, 500), 'resume');
    assert.equal(decideStartup({bootId: 'B1', endsAt: 1000}, x11, 1500), 'restore');
    assert.equal(decideStartup({bootId: 'B0', endsAt: 1000}, x11, 500), 'restore');
    // Wayland: a new Shell process is a new login, window ids are meaningless
    assert.equal(decideStartup({bootId: 'B1', endsAt: 1000, shellInstance: 'S1'}, wl, 500), 'resume');
    assert.equal(decideStartup({bootId: 'B1', endsAt: 1000, shellInstance: 'S0'}, wl, 500), 'restore');
    assert.equal(decideStartup({bootId: 'B1', endsAt: 1000}, wl, 500), 'restore');
});

test('browserOfWmClass: firefox from Mozilla deb/tarball', () => {
    assert.equal(browserOfWmClass('firefox', 'Navigator'), 'firefox');
    assert.equal(browserOfWmClass('firefox_firefox', 'firefox_firefox'), 'firefox');
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec** — Run: `node --test tests/policy.test.mjs` — Expected: FAIL sur `decideStartup`.

- [ ] **Step 3 : Implémenter** `decideStartup` (signature ci-dessus) ; `currentShellInstance()` ; dans `extension.js` : `const env = {bootId: currentBootId(), shellInstance: currentShellInstance(), wayland: Meta.is_wayland_compositor()}` (import `Meta from 'gi://Meta'`), et `shellInstance: env.shellInstance` dans l'état créé par `_lock`. Mettre à jour le commentaire de `windowId` : « X11: the XID, stable across a Shell restart. Wayland: the stable sequence, valid for this Shell process only (see decideStartup). »

- [ ] **Step 4 : Lancer les tests** — Run: `npm test` — Expected: PASS.

- [ ] **Step 5 : Commit** — `git commit -am "fix(gnome): never resume a session into another Wayland shell"`

---

### Task 5 : Le pont embarqué — l'extension écrit ses manifestes

**Files:**
- Create: `lib/constants.js`, `lib/hostManifests.js`, `lib/hostSetup.js`, `tests/host-manifests.test.mjs`, `tests/gjs/host-setup.test.js`
- Modify: `extension.js` (`enable`), `package.json` (script test), `tests/release.test.mjs`

**Interfaces:**
- Produces `lib/constants.js` : `export const CHROME_EXTENSION_ID = 'jegdmipkacdhhlldnopafmjhakdmddik'; export const GECKO_ID = 'deep-work-lock@deepwork.local'; export const HOST_NAME = 'org.deepworklock.host';`
- Produces `lib/hostManifests.js` (aucun import `gi://`) :
  `export function nativeHostManifests(hostPath: string): Array<{relativePath: string, content: object}>` → deux entrées, dans cet ordre :
  - `.config/google-chrome/NativeMessagingHosts/org.deepworklock.host.json` → `{name: HOST_NAME, description: 'Deep Work Lock bridge between Chrome and GNOME Shell', path: hostPath, type: 'stdio', allowed_origins: ['chrome-extension://jegdmipkacdhhlldnopafmjhakdmddik/']}`
  - `.mozilla/native-messaging-hosts/org.deepworklock.host.json` → `{name: HOST_NAME, description: 'Deep Work Lock bridge between Firefox and GNOME Shell', path: hostPath, type: 'stdio', allowed_extensions: ['deep-work-lock@deepwork.local']}`
  `export function hostPathFor(extensionPath: string): string` → `${extensionPath}/native-host/deep_work_lock_host.py`.
- Produces `lib/hostSetup.js` : `export function installNativeHost(extensionPath: string): {written: string[], errors: string[]}` — écrit chaque manifeste sous `GLib.get_home_dir()` (création des dossiers, écriture seulement si le contenu diffère), `chmod 0o755` sur le script hôte, et si `/snap/bin/firefox` existe appelle `PermissionStore.SetPermission('webextensions', true, HOST_NAME, 'snap.firefox', ['yes'])` ; ne lève jamais, consigne dans `errors`.
- Consumes : `RELEASE` (test de cohérence des constantes).

- [ ] **Step 1 : Tests Node**

```js
// tests/host-manifests.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativeHostManifests, hostPathFor} from '../gnome-extension/deep-work-lock@helmo21.github.io/lib/hostManifests.js';
import {RELEASE} from '../scripts/release-config.mjs';

test('manifests point at the bundled host', () => {
    const host = hostPathFor('/home/u/.local/share/gnome-shell/extensions/x');
    assert.equal(host, '/home/u/.local/share/gnome-shell/extensions/x/native-host/deep_work_lock_host.py');
    const [chrome, firefox] = nativeHostManifests(host);
    assert.equal(chrome.relativePath, '.config/google-chrome/NativeMessagingHosts/org.deepworklock.host.json');
    assert.deepEqual(chrome.content, {name: 'org.deepworklock.host',
        description: 'Deep Work Lock bridge between Chrome and GNOME Shell', path: host, type: 'stdio',
        allowed_origins: [`chrome-extension://${RELEASE.chromeExtensionId}/`]});
    assert.equal(firefox.relativePath, '.mozilla/native-messaging-hosts/org.deepworklock.host.json');
    assert.deepEqual(firefox.content.allowed_extensions, [RELEASE.geckoId]);
    assert.equal(firefox.content.path, host);
});
```

Dans `tests/release.test.mjs`, ajouter un test qui importe `lib/constants.js` et vérifie `CHROME_EXTENSION_ID === RELEASE.chromeExtensionId`, `GECKO_ID === RELEASE.geckoId`, `HOST_NAME === RELEASE.hostName`.

- [ ] **Step 2 : Test GJS** (`tests/gjs/host-setup.test.js`, lancé avec `HOME=<tmp>`) : créer un faux dossier d'extension avec `native-host/deep_work_lock_host.py` (mode 0o644) et un ancien manifeste Chrome pointant vers `/home/u/.local/share/deep-work-lock/deep_work_lock_host.py` ; appeler `installNativeHost(dir)` ; vérifier : les deux fichiers existent sous `$HOME`, le `path` du manifeste Chrome est le nouveau, le script est exécutable (`Gio.FileInfo` `unix::mode & 0o111`), `errors.length === 0` ; appeler une deuxième fois → `written.length === 0`. Le test refuse de tourner si `HOME` n'est pas sous `/tmp` (`throw`).

- [ ] **Step 3 : Lancer, vérifier l'échec** — Run: `node --test tests/host-manifests.test.mjs` — Expected: FAIL (module absent).

- [ ] **Step 4 : Implémenter `constants.js`, `hostManifests.js`, `hostSetup.js`** ; dans `extension.js` `enable()`, après la récupération post-plantage et avant la création de l'indicateur : `const {errors} = installNativeHost(this.path); errors.forEach(e => console.warn(\`[deep-work-lock] native host setup: ${e}\`));`. Le portail : `Gio.DBus.session.call_sync('org.freedesktop.impl.portal.PermissionStore', '/org/freedesktop/impl/portal/PermissionStore', 'org.freedesktop.impl.portal.PermissionStore', 'SetPermission', new GLib.Variant('(sbssas)', ['webextensions', true, HOST_NAME, 'snap.firefox', ['yes']]), null, Gio.DBusCallFlags.NONE, 2000, null)` dans un `try`.

- [ ] **Step 5 : Script de test** dans `package.json` : ajouter à `test` : `&& HOME=$(mktemp -d) gjs -m tests/gjs/host-setup.test.js`.

- [ ] **Step 6 : Lancer les tests** — Run: `npm test` — Expected: PASS, dont `host-setup.test.js: all assertions passed`.

- [ ] **Step 7 : Commit** — `git commit -am "feat(gnome): bundle the native host and install its manifests on enable"`

---

### Task 6 : Icônes et paquets (GNOME zip, Chrome zip, Firefox avec `update_url`)

**Files:**
- Create: `assets/icon.svg`, `scripts/render-icons.mjs`, `chrome-extension/icons/icon-{16,48,128}.png`, `scripts/build-gnome.mjs`, `scripts/build-chrome.mjs`, `tests/build.test.mjs`
- Modify: `scripts/build-firefox.mjs`, `chrome-extension/manifest.json` (`icons`, `action`? non : pas d'action), `tests/firefox-manifest.test.mjs`, `package.json` (devDependency `sharp`, scripts `build`), `scripts/sign-firefox.sh`

**Interfaces:**
- Produces `scripts/build-gnome.mjs` : `export function buildGnome(outDir: string): {dir: string, zip: string}` — copie `gnome-extension/<uuid>/` dans `outDir/<uuid>/`, y ajoute `native-host/deep_work_lock_host.py` (mode 0o755), `LICENSE`, exclut `__pycache__`, puis `zip -r` en `outDir/<uuid>.shell-extension.zip` (contenu à la racine du zip, comme l'exige extensions.gnome.org).
- Produces `scripts/build-chrome.mjs` : `export function buildChrome(outDir: string): {dir: string, zip: string}` — copie `chrome-extension/` (manifest, `background.js`, `lock.js`, `icons/`) dans `outDir/chrome/`, zip en `outDir/deep-work-lock-chrome-<version>.zip`.
- `scripts/build-firefox.mjs` : `firefoxManifest(chromeManifest, siteUrl = RELEASE.siteUrl)` ajoute `browser_specific_settings.gecko.update_url = \`${siteUrl}/updates.json\`` ; `build()` copie aussi `icons/` ; `SHARED_FILES` inclut les icônes.
- Produces `scripts/render-icons.mjs` : rend `assets/icon.svg` en PNG 16/48/128 avec `sharp` ; PNG **committés** (le build ne dépend pas de sharp).
- `package.json` scripts : `"build": "node scripts/build-gnome.mjs && node scripts/build-chrome.mjs && node scripts/build-firefox.mjs"`.

- [ ] **Step 1 : Tests**

Dans `tests/firefox-manifest.test.mjs`, remplacer l'assertion `deepEqual(browser_specific_settings …)` par :

```js
assert.deepEqual(ff.browser_specific_settings, {gecko: {id: 'deep-work-lock@deepwork.local',
    strict_min_version: '140.0', data_collection_permissions: {required: ['none']},
    update_url: 'https://example.invalid/updates.json'}});
assert.deepEqual(firefoxManifest(chrome, 'https://dwl.test').browser_specific_settings.gecko.update_url, 'https://dwl.test/updates.json');
assert.deepEqual(ff.icons, chrome.icons);
```

```js
// tests/build.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, existsSync, readFileSync, statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildGnome} from '../scripts/build-gnome.mjs';
import {buildChrome} from '../scripts/build-chrome.mjs';
import {RELEASE} from '../scripts/release-config.mjs';

test('gnome zip carries the host at the root layout e.g.o expects', () => {
    const out = mkdtempSync(join(tmpdir(), 'dwl-'));
    const {dir, zip} = buildGnome(out);
    assert.ok(existsSync(join(dir, 'native-host', 'deep_work_lock_host.py')));
    assert.equal(statSync(join(dir, 'native-host', 'deep_work_lock_host.py')).mode & 0o111, 0o111);
    assert.ok(existsSync(join(dir, 'LICENSE')));
    const listing = execFileSync('unzip', ['-Z1', zip], {encoding: 'utf8'});
    assert.match(listing, /^metadata\.json$/m);
    assert.match(listing, /^extension\.js$/m);
    assert.match(listing, /^native-host\/deep_work_lock_host\.py$/m);
    assert.doesNotMatch(listing, /__pycache__/);
});

test('chrome zip', () => {
    const out = mkdtempSync(join(tmpdir(), 'dwl-'));
    const {zip} = buildChrome(out);
    assert.equal(zip, join(out, `deep-work-lock-chrome-${RELEASE.version}.zip`));
    const listing = execFileSync('unzip', ['-Z1', zip], {encoding: 'utf8'});
    for (const f of ['manifest.json', 'background.js', 'lock.js', 'icons/icon-128.png'])
        assert.match(listing, new RegExp(`^${f.replace('.', '\\.')}$`, 'm'));
});

test('manifest declares the icons', () => {
    const m = JSON.parse(readFileSync('chrome-extension/manifest.json', 'utf8'));
    assert.deepEqual(m.icons, {16: 'icons/icon-16.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png'});
    for (const f of Object.values(m.icons))
        assert.ok(existsSync(join('chrome-extension', f)), f);
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec** — Run: `node --test tests/build.test.mjs tests/firefox-manifest.test.mjs` — Expected: FAIL.

- [ ] **Step 3 : Icône** : `assets/icon.svg` = fond rond sombre (`#111827`), anneau orange (`#f97316`, l'orange du compte à rebours) et point central, 128×128 viewBox. `pnpm add -D sharp` à la racine (ou `npm i -D sharp` : le dépôt racine utilise npm) ; `node scripts/render-icons.mjs` ; ajouter `icons` au manifeste Chrome.

- [ ] **Step 4 : Implémenter `build-gnome.mjs`, `build-chrome.mjs`, modifier `build-firefox.mjs`** ; `sign-firefox.sh` : après signature, copier le `.xpi` vers `site/public/releases/deep-work-lock-<version>.xpi` et `deep-work-lock-latest.xpi` (le dossier est créé en tâche 10 ; `mkdir -p`), et refuser de signer si `siteUrl` vaut `https://example.invalid` (lecture par `node -p`).

- [ ] **Step 5 : Lancer les tests** — Run: `npm test && npm run build` — Expected: PASS ; `build/gnome/deep-work-lock@helmo21.github.io.shell-extension.zip`, `build/deep-work-lock-chrome-0.2.0.zip`, `build/firefox/` présents.

- [ ] **Step 6 : Commit** — `git add -A assets chrome-extension/icons scripts tests package.json package-lock.json && git commit -m "build: icons, e.g.o zip, chrome zip, firefox update_url"`

---

### Task 7 : Politiques navigateur (`scripts/policies.py`)

**Files:**
- Create: `scripts/policies.py`, `scripts/test_policies.py`
- Modify: `package.json` (ajouter `python3 -m unittest discover -s scripts -p 'test_*.py'` au script `test`)

**Interfaces:**
- Produces (module importable, Python 3.10+, stdlib seulement) :
  - `chrome_policy(extension_id: str) -> dict` → `{"ExtensionSettings": {extension_id: {"installation_mode": "normal_installed", "update_url": "https://clients2.google.com/service/update2/crx"}}}`
  - `firefox_entry(install_url: str) -> dict` → `{"installation_mode": "normal_installed", "install_url": install_url}`
  - `merge_firefox(existing: dict | None, gecko_id: str, install_url: str) -> dict` : conserve tout `existing`, garantit `policies.ExtensionSettings[gecko_id] == firefox_entry(install_url)`.
  - `remove_firefox(existing: dict | None, gecko_id: str) -> dict | None` : retire l'entrée ; renvoie `None` si le fichier ne contenait que notre entrée (le fichier peut alors être supprimé), sinon le document restant.
  - CLI : `policies.py install --etc DIR --chrome-id ID --gecko-id ID --install-url URL [--chrome] [--firefox]` et `policies.py remove --etc DIR --chrome-id ID --gecko-id ID [--chrome] [--firefox]`. Chemins : `DIR/opt/chrome/policies/managed/deep-work-lock.json`, `DIR/firefox/policies/policies.json`. Écriture atomique (fichier temporaire + `os.replace`), mode 0o644, dossiers créés 0o755. Sortie : une ligne par fichier écrit ou supprimé. Code de retour 0 ; 1 si `policies.json` existant n'est pas un JSON objet (ne jamais écraser un fichier qu'on ne sait pas lire).

- [ ] **Step 1 : Tests**

```python
# scripts/test_policies.py
import json, os, subprocess, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(__file__))
import policies

URL = "https://example.invalid/releases/deep-work-lock-latest.xpi"

class PureTest(unittest.TestCase):
    def test_chrome_policy(self):
        self.assertEqual(policies.chrome_policy("abc"), {"ExtensionSettings": {"abc": {
            "installation_mode": "normal_installed",
            "update_url": "https://clients2.google.com/service/update2/crx"}}})

    def test_merge_keeps_other_policies(self):
        existing = {"policies": {"DisableTelemetry": True,
                                 "ExtensionSettings": {"other@x": {"installation_mode": "blocked"}}}}
        merged = policies.merge_firefox(existing, "g@x", URL)
        self.assertTrue(merged["policies"]["DisableTelemetry"])
        self.assertEqual(merged["policies"]["ExtensionSettings"]["other@x"], {"installation_mode": "blocked"})
        self.assertEqual(merged["policies"]["ExtensionSettings"]["g@x"],
                         {"installation_mode": "normal_installed", "install_url": URL})
        self.assertIsNot(merged, existing)

    def test_merge_from_nothing_and_idempotent(self):
        once = policies.merge_firefox(None, "g@x", URL)
        self.assertEqual(policies.merge_firefox(once, "g@x", URL), once)

    def test_remove(self):
        only_ours = policies.merge_firefox(None, "g@x", URL)
        self.assertIsNone(policies.remove_firefox(only_ours, "g@x"))
        shared = policies.merge_firefox({"policies": {"DisableTelemetry": True}}, "g@x", URL)
        self.assertEqual(policies.remove_firefox(shared, "g@x"), {"policies": {"DisableTelemetry": True}})
        self.assertIsNone(policies.remove_firefox(None, "g@x"))

class CliTest(unittest.TestCase):
    def run_cli(self, *args):
        return subprocess.run([sys.executable, policies.__file__, *args], capture_output=True, text=True)

    def test_install_then_remove(self):
        with tempfile.TemporaryDirectory() as etc:
            r = self.run_cli("install", "--etc", etc, "--chrome-id", "abc", "--gecko-id", "g@x",
                             "--install-url", URL, "--chrome", "--firefox")
            self.assertEqual(r.returncode, 0, r.stderr)
            chrome = os.path.join(etc, "opt/chrome/policies/managed/deep-work-lock.json")
            firefox = os.path.join(etc, "firefox/policies/policies.json")
            self.assertEqual(json.load(open(chrome)), policies.chrome_policy("abc"))
            self.assertIn("g@x", json.load(open(firefox))["policies"]["ExtensionSettings"])
            self.assertEqual(oct(os.stat(chrome).st_mode & 0o777), "0o644")
            r = self.run_cli("remove", "--etc", etc, "--chrome-id", "abc", "--gecko-id", "g@x", "--chrome", "--firefox")
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertFalse(os.path.exists(chrome))
            self.assertFalse(os.path.exists(firefox))

    def test_only_firefox(self):
        with tempfile.TemporaryDirectory() as etc:
            self.run_cli("install", "--etc", etc, "--chrome-id", "abc", "--gecko-id", "g@x",
                         "--install-url", URL, "--firefox")
            self.assertFalse(os.path.exists(os.path.join(etc, "opt/chrome")))
            self.assertTrue(os.path.exists(os.path.join(etc, "firefox/policies/policies.json")))

    def test_refuses_unreadable_policies_json(self):
        with tempfile.TemporaryDirectory() as etc:
            os.makedirs(os.path.join(etc, "firefox/policies"))
            with open(os.path.join(etc, "firefox/policies/policies.json"), "w") as f:
                f.write("not json")
            r = self.run_cli("install", "--etc", etc, "--chrome-id", "abc", "--gecko-id", "g@x",
                             "--install-url", URL, "--firefox")
            self.assertEqual(r.returncode, 1)
            self.assertEqual(open(os.path.join(etc, "firefox/policies/policies.json")).read(), "not json")

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2 : Lancer, vérifier l'échec** — Run: `python3 -m unittest discover -s scripts -p 'test_*.py'` — Expected: FAIL (import).

- [ ] **Step 3 : Implémenter `scripts/policies.py`** (argparse, `json`, `tempfile`, `os.replace`).

- [ ] **Step 4 : Lancer les tests** — Run: `npm test` — Expected: PASS.

- [ ] **Step 5 : Commit** — `git add scripts/policies.py scripts/test_policies.py package.json && git commit -m "feat: browser policy writer (normal_installed, merges policies.json)"`

---

### Task 8 : Les scripts publics `install.sh` et `uninstall.sh`

**Files:**
- Create: `scripts/install.sh`, `scripts/uninstall.sh`, `scripts/dev-install.sh`, `tests/install-script.test.mjs`
- Delete: `install.sh`, `uninstall.sh` (racine)
- Modify: `README.md` (section développement, provisoire : réécrit en tâche 11)

**Interfaces:**
- `scripts/install.sh` (bash, `set -euo pipefail`) lit ses paramètres dans des variables substituables pour les tests :
  `SITE_URL="${DWL_SITE_URL:-@@SITE_URL@@}"`, `UUID="${DWL_UUID:-deep-work-lock@helmo21.github.io}"`, `VERSION="${DWL_VERSION:-@@VERSION@@}"`, `REPO="${DWL_REPO:-Helmo21/deep-work-lock}"`, `CHROME_ID`, `GECKO_ID`, `HOST_NAME` (littéraux des Global Constraints), `HOME_DIR="${DWL_HOME:-$HOME}"`, `ETC_DIR="${DWL_ETC:-/etc}"`, `SUDO="${DWL_SUDO:-sudo}"`, `GDBUS="${DWL_GDBUS:-gdbus}"`, `GNOME_EXTENSIONS="${DWL_GNOME_EXTENSIONS:-gnome-extensions}"`, `CURL="${DWL_CURL:-curl}"`, `DRY_RUN="${DWL_DRY_RUN:-0}"`. Le script télécharge `policies.py` depuis `$SITE_URL/policies.py` dans un dossier temporaire (ou l'utilise depuis `DWL_POLICIES_PY` s'il est défini). Les `@@…@@` sont substitués par `prepare-site.mjs` (tâche 10).
- Étapes et sorties (anglais, une ligne `→ …` par étape) :
  1. `Checking your system` : GNOME Shell présent et `gnome-shell --version` entre 46 et 49, `python3`, `python3 -c 'import gi'`, `gdbus`, au moins un navigateur (`google-chrome` dans `PATH` ou `/opt/google/chrome/chrome` ; `firefox` dans `PATH` ou `/snap/bin/firefox`). Échec → message `Deep Work Lock needs …` et `exit 1`, rien n'a été modifié.
  2. `Installing the GNOME extension from extensions.gnome.org` : si `GetExtensionInfo` dit déjà installé → `EnableExtension` ; sinon `InstallRemoteExtension "$UUID"` ; résultat `'successful'` → attendre jusqu'à 15 s que `GetExtensionInfo` donne `state` = 1 (ACTIVE) ; `'cancelled'` → `You cancelled the GNOME dialog. Run the command again when you are ready.` et `exit 2` ; toute autre erreur → **repli** : télécharger `https://github.com/$REPO/releases/download/v$VERSION/$UUID.shell-extension.zip`, `gnome-extensions install --force`, ajouter l'UUID à `org.gnome.shell enabled-extensions` (python3 + `gsettings`), puis `FALLBACK=1`. Vérifier ensuite que `$HOME_DIR/.config/google-chrome/NativeMessagingHosts/$HOST_NAME.json` existe (sauf repli).
  3. `Installing the browser extension (asks for your password once)` : `$SUDO python3 policies.py install --etc "$ETC_DIR" … --chrome` / `--firefox` selon les navigateurs détectés, `--install-url "$SITE_URL/releases/deep-work-lock-latest.xpi"`.
  4. Bilan : liste de ce qui a été fait ; `Restart Chrome/Firefox to see the extension.` ; si `FALLBACK=1` : `Log out and back in to finish, then click ◉ Focus in the top bar.` sinon `Click ◉ Focus in the top bar.`
  - `DRY_RUN=1` : chaque commande qui modifie le système est affichée préfixée `+ ` au lieu d'être exécutée (sauf `gdbus`, `gnome-shell --version` et détections, qui s'exécutent : les tests leur substituent des faux).
- `scripts/uninstall.sh` : mêmes variables ; restauration des réglages si `session.json` existe (reprendre le bloc Python de l'ancien `uninstall.sh`) ; `UninstallExtension "$UUID"` par D-Bus (repli : `gnome-extensions disable` + `rm -rf`) ; suppression des deux manifestes et `PermissionStore.DeletePermission` ; `$SUDO python3 policies.py remove …` ; suppression du dossier d'état ; message `Deep Work Lock is uninstalled. The browser extension disappears when you restart the browser.`
- `scripts/dev-install.sh` : pour développer sans catalogues : `npm run build`, lien symbolique `~/.local/share/gnome-shell/extensions/$UUID` → `build/gnome/$UUID`, écriture des manifestes par `python3 -c` à partir de `hostManifests` ? Non : l'extension les écrit à l'activation ; le script se contente du lien, de `gnome-extensions enable` (avec le rappel « log out and back in on first install »), et rappelle comment charger l'extension Chrome non empaquetée depuis `build/chrome/` et l'extension Firefox temporaire depuis `build/firefox/`.

- [ ] **Step 1 : Test**

```js
// tests/install-script.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, chmodSync, mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

function sandbox({gdbusResult = "('successful',)", state = 1, chrome = true, firefox = true} = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'dwl-install-'));
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    const fake = (name, body) => { writeFileSync(join(bin, name), `#!/bin/bash\n${body}\n`); chmodSync(join(bin, name), 0o755); };
    fake('gdbus', `case "$*" in *InstallRemoteExtension*) echo "${gdbusResult}";; *GetExtensionInfo*) echo "({'state': <${state}.0>, 'uuid': <'x'>},)";; *) echo "()";; esac`);
    fake('gnome-shell', 'echo "GNOME Shell 46.0"');
    fake('sudo', 'echo "+ sudo $*"');
    if (chrome) fake('google-chrome', 'true');
    if (firefox) fake('firefox', 'true');
    mkdirSync(join(dir, 'home/.config/google-chrome/NativeMessagingHosts'), {recursive: true});
    writeFileSync(join(dir, 'home/.config/google-chrome/NativeMessagingHosts/org.deepworklock.host.json'), '{}');
    return {dir, env: {...process.env, PATH: `${bin}:${process.env.PATH}`, DWL_HOME: join(dir, 'home'), DWL_ETC: join(dir, 'etc'),
        DWL_SITE_URL: 'https://dwl.test', DWL_VERSION: '0.2.0', DWL_DRY_RUN: '1', DWL_POLICIES_PY: 'scripts/policies.py'}};
}

const run = (env, script = 'scripts/install.sh') => spawnSync('bash', [script], {env, encoding: 'utf8'});

test('happy path: e.g.o install, both browsers, no logout needed', () => {
    const {env} = sandbox();
    const r = run(env);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Installing the GNOME extension from extensions\.gnome\.org/);
    assert.match(r.stdout, /\+ sudo .*policies\.py install .*--chrome .*--firefox|\+ sudo .*policies\.py install .*--firefox .*--chrome/);
    assert.match(r.stdout, /--install-url https:\/\/dwl\.test\/releases\/deep-work-lock-latest\.xpi/);
    assert.match(r.stdout, /Click ◉ Focus in the top bar/);
    assert.doesNotMatch(r.stdout, /Log out/);
});

test('running twice gives the same output', () => {
    const {env} = sandbox();
    assert.equal(run(env).stdout, run(env).stdout);
});

test('only chrome installed: no firefox policy', () => {
    const {env} = sandbox({firefox: false});
    const out = run(env).stdout;
    assert.match(out, /policies\.py install .*--chrome/);
    assert.doesNotMatch(out, /--firefox/);
});

test('cancelled GNOME dialog stops before sudo', () => {
    const {env} = sandbox({gdbusResult: "('cancelled',)"});
    const r = run(env);
    assert.equal(r.status, 2);
    assert.match(r.stdout + r.stderr, /You cancelled the GNOME dialog/);
    assert.doesNotMatch(r.stdout, /sudo/);
});

test('e.g.o failure falls back to the release zip and asks to log out', () => {
    const {env} = sandbox({gdbusResult: 'Error: org.gnome.Shell.ExtensionError: not found'});
    const r = run({...env, DWL_CURL: 'echo', DWL_GNOME_EXTENSIONS: 'echo'});
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /releases\/download\/v0\.2\.0\/deep-work-lock@helmo21\.github\.io\.shell-extension\.zip/);
    assert.match(r.stdout, /Log out and back in to finish/);
});

test('no browser: refuses before touching anything', () => {
    const {env} = sandbox({chrome: false, firefox: false});
    const r = run(env);
    assert.equal(r.status, 1);
    assert.doesNotMatch(r.stdout, /InstallRemoteExtension|sudo/);
});

test('uninstall removes policies and the extension', () => {
    const {env} = sandbox();
    const r = run(env, 'scripts/uninstall.sh');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /\+ sudo .*policies\.py remove/);
    assert.match(r.stdout, /Deep Work Lock is uninstalled/);
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec** — Run: `node --test tests/install-script.test.mjs` — Expected: FAIL (script absent).

- [ ] **Step 3 : Écrire `scripts/install.sh`, `scripts/uninstall.sh`, `scripts/dev-install.sh`** ; supprimer `install.sh` et `uninstall.sh` à la racine (`git rm`). `bash -n` sur les trois.

- [ ] **Step 4 : Lancer les tests** — Run: `npm test` — Expected: PASS.

- [ ] **Step 5 : Essai réel du chemin développeur** : `scripts/dev-install.sh` sur la machine (X11) ; après déconnexion/reconnexion, vérifier que l'extension s'active et que `~/.config/google-chrome/NativeMessagingHosts/org.deepworklock.host.json` pointe vers `build/gnome/<uuid>/native-host/deep_work_lock_host.py` ; Chrome (extension non empaquetée depuis `build/chrome/`) liste ses onglets dans le menu.
Expected: verrou d'onglet Chrome fonctionnel comme avant la sortie.

- [ ] **Step 6 : Commit** — `git add -A scripts tests install.sh uninstall.sh README.md && git commit -m "feat: public install/uninstall scripts, dev-install"`

---

### Task 9 : Le site — squelette et page d'accueil (option B)

**Files:**
- Rename: `modern-cli-tool-landing-page/` → `site/` (`git mv` après `git add` : le dossier n'est pas encore suivi)
- Modify: `site/package.json` (nom `deep-work-lock-site`, retirer `@vercel/analytics`), `site/app/layout.tsx`, `site/app/page.tsx`, `site/app/globals.css` si besoin
- Create: `site/lib/site-config.ts`, `site/release.json` (copie, générée en tâche 10 ; pour cette tâche, copie manuelle), `site/components/copy-command.tsx`
- Delete: `site/public/placeholder-*.{png,svg,jpg}`, `site/public/placeholder-user.jpg`

**Interfaces:**
- Produces `site/lib/site-config.ts` : `import release from '../release.json'; export const SITE = {version: release.version, siteUrl: release.siteUrl, repoUrl: \`https://github.com/${release.repo}\`, installCommand: \`curl -fsSL ${release.siteUrl}/install.sh | sh\`, uninstallCommand: \`curl -fsSL ${release.siteUrl}/uninstall.sh | sh\`};`
- Produces `site/components/copy-command.tsx` : `<CopyCommand command={string} id={string} />` — le bloc de commande avec bouton copier du template, extrait en composant client, utilisé par l'accueil et les docs.
- `layout.tsx` : `metadata.title = 'Deep Work Lock'`, `description = 'Lock your screen on one window, app or browser tab until the timer runs out. No stop button.'`, suppression d'`Analytics`, `lang="en"`.

- [ ] **Step 1 : Déplacer et nettoyer** : `git mv`, retirer `@vercel/analytics` de `package.json` et de `layout.tsx`, supprimer les placeholders, `pnpm install` dans `site/`.

- [ ] **Step 2 : Vérifier que le squelette construit** — Run: `cd site && pnpm build` — Expected: `✓ Compiled` sans erreur (les erreurs TypeScript sont ignorées par `next.config.mjs` : ne pas s'y fier, lire la sortie).

- [ ] **Step 3 : Réécrire `app/page.tsx`** selon la maquette B, en gardant le style du template (fond noir, bordures `gray-800`, police mono pour les commandes) et en retirant les animations « terminal » et les sections modèles IA / IDE. Structure et copie :
  - Nav : `◉ DEEP WORK LOCK` · `How it works` · `Install` · `Docs` · `GitHub` (lien `SITE.repoUrl`) ; à droite, `<CopyCommand>` compact.
  - Hero : `One target. One timer. No stop button.` ; sous-titre : `Deep Work Lock keeps a single window, app or browser tab in front of you until the countdown ends. Everything else on your desktop is switched off.` ; `<CopyCommand command={SITE.installCommand} id="hero" />` ; ligne : `Linux · GNOME 46–49 · X11 and Wayland · Chrome and Firefox` ; pastilles : `Windows — coming soon`, `macOS — coming soon`.
  - Section `How it works` (id `how`) : trois cartes : `Pick a duration and a target` (25 to 90 minutes or your own; a window, a whole app, or one Chrome or Firefox tab) ; `Your desktop goes quiet` (top bar and dock greyed out, Alt+Tab and Super disabled, notifications off, other windows minimised) ; `Tabs stay locked` (new tabs and windows closed, navigation kept on the tab's site, internal pages blocked).
  - Section `Install` (id `install`) : la commande, puis `What the command does` en trois étapes numérotées : `1. Loads the GNOME extension from extensions.gnome.org — GNOME asks you to confirm, one click.` `2. The extension installs its own bridge to your browsers — in your home folder, no root.` `3. Adds the browser extension to Chrome and Firefox — asks for your password once, then restart your browser.` Puis : `Requirements: GNOME Shell 46 to 49, Python 3, Google Chrome (deb) and/or Firefox (snap or Mozilla build).` et un lien `Read the script before running it` vers `${SITE.siteUrl}/install.sh`.
  - Pied : `Uninstall` (lien `/docs#uninstall`), `Privacy` (`/privacy`), `GitHub`, `v${SITE.version}`, `GPL-3.0`.

- [ ] **Step 4 : Construire et regarder** — Run: `cd site && pnpm build && pnpm start -p 3100` puis ouvrir `http://localhost:3100` — Expected: la page correspond à la maquette B ; le bouton copier met `curl -fsSL https://example.invalid/install.sh | sh` dans le presse-papier ; largeur téléphone sans défilement horizontal.

- [ ] **Step 5 : Commit** — `git add -A site .gitignore && git commit -m "feat(site): landing page from the template, option B"`

---

### Task 10 : Le site — Docs, Privacy, fichiers servis, `prepare-site.mjs`

**Files:**
- Create: `site/app/docs/page.tsx` (réécrit), `site/app/privacy/page.tsx`, `scripts/prepare-site.mjs`, `site/public/releases/.gitkeep`, `tests/build.test.mjs` (ajout)
- Generated: `site/release.json`, `site/public/install.sh`, `site/public/uninstall.sh`, `site/public/policies.py`, `site/public/updates.json`
- Modify: `package.json` (script `prepare-site`), `site/next.config.mjs` (en-têtes)

**Interfaces:**
- Produces `scripts/prepare-site.mjs` : `export function prepareSite(siteDir: string, release = RELEASE): string[]` (chemins écrits) — copie `release.json` ; copie `scripts/install.sh` et `scripts/uninstall.sh` dans `siteDir/public/` en remplaçant `@@SITE_URL@@` par `release.siteUrl` et `@@VERSION@@` par `release.version` ; copie `scripts/policies.py` ; écrit `updates.json` = `{"addons": {[release.geckoId]: {"updates": [{"version": release.version, "update_link": \`${release.siteUrl}/releases/deep-work-lock-${release.version}.xpi\`}]}}}`. Un `@@` restant dans une sortie fait échouer la fonction.
- `site/next.config.mjs` : `headers()` : pour `/install.sh`, `/uninstall.sh`, `/policies.py` → `Content-Type: text/plain; charset=utf-8`, `Cache-Control: no-cache` ; pour `/releases/:file*` → `Content-Type: application/x-xpinstall`, `Cache-Control: public, max-age=3600` ; `/updates.json` → `Cache-Control: no-cache`.
- Docs : page à sections ancrées (sidebar du template réduite) : `How it works`, `Install` (commande + les trois étapes + `Requirements`), `Using it` (menu ◉ Focus, durées, cibles, `Lock for N min`), `During a session` (liste du README), `Behaviour choices` (README « Choix de comportement », en anglais), `Known limits` (README), `Troubleshooting` (`The GNOME dialog never appeared` → relancer la commande ; `◉ Focus is missing after install` → log out and back in ; `Chrome does not show the extension` → restart Chrome, wait a minute, check `chrome://policy` ; `Firefox tabs are "unavailable"` → restart Firefox, re-run the command (snap portal permission) ; `Chrome says "managed by your organization"` → explication, retiré par la désinstallation ; `Several accounts on this computer` → policies apply to every account, the GNOME lock only to yours), `Uninstall` (id `uninstall`, `<CopyCommand command={SITE.uninstallCommand}>`), `Development` (lien dépôt, `scripts/dev-install.sh`).
- Privacy : `Deep Work Lock does not collect, store or transmit any personal data. The browser extension talks only to the GNOME extension on your own computer. The only network requests are update checks made by your browser and by GNOME, to the Chrome Web Store, to ${siteUrl}/updates.json and to extensions.gnome.org.` + contact : lien vers les issues GitHub.

- [ ] **Step 1 : Test** (ajout à `tests/build.test.mjs`)

```js
import {prepareSite} from '../scripts/prepare-site.mjs';

test('prepare-site substitutes the url and writes updates.json', () => {
    const out = mkdtempSync(join(tmpdir(), 'dwl-site-'));
    mkdirSync(join(out, 'public'), {recursive: true});
    const release = {...RELEASE, siteUrl: 'https://dwl.test', version: '9.9.9'};
    prepareSite(out, release);
    const install = readFileSync(join(out, 'public/install.sh'), 'utf8');
    assert.match(install, /SITE_URL="\$\{DWL_SITE_URL:-https:\/\/dwl\.test\}"/);
    assert.match(install, /VERSION="\$\{DWL_VERSION:-9\.9\.9\}"/);
    assert.doesNotMatch(install, /@@/);
    assert.ok(existsSync(join(out, 'public/uninstall.sh')));
    assert.ok(existsSync(join(out, 'public/policies.py')));
    assert.deepEqual(JSON.parse(readFileSync(join(out, 'public/updates.json'), 'utf8')), {addons: {
        'deep-work-lock@deepwork.local': {updates: [{version: '9.9.9', update_link: 'https://dwl.test/releases/deep-work-lock-9.9.9.xpi'}]}}});
    assert.deepEqual(JSON.parse(readFileSync(join(out, 'release.json'), 'utf8')), release);
});

test('the committed site files are up to date', () => {
    const out = mkdtempSync(join(tmpdir(), 'dwl-site-'));
    mkdirSync(join(out, 'public'), {recursive: true});
    for (const written of prepareSite(out)) {
        const rel = written.slice(out.length + 1);
        assert.equal(readFileSync(join('site', rel), 'utf8'), readFileSync(written, 'utf8'), `${rel} is stale: run npm run prepare-site`);
    }
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec** — Run: `node --test tests/build.test.mjs` — Expected: FAIL.

- [ ] **Step 3 : Implémenter `prepare-site.mjs`**, script `"prepare-site": "node scripts/prepare-site.mjs site"`, l'exécuter, écrire `next.config.mjs` (`headers()`), les pages Docs et Privacy. Dans `.gitignore` racine, ajouter `!site/public/releases/*.xpi` après `*.xpi` pour que les `.xpi` publiés soient bien committés.

- [ ] **Step 4 : Lancer les tests et construire** — Run: `npm test && (cd site && pnpm build)` — Expected: PASS ; build OK.

- [ ] **Step 5 : Vérifier les fichiers servis** — Run: `cd site && pnpm start -p 3100 & sleep 3; curl -sI http://localhost:3100/install.sh | grep -iE "content-type|cache-control"; curl -s http://localhost:3100/updates.json` — Expected: `text/plain`, `no-cache`, et le JSON `updates.json`.

- [ ] **Step 6 : Commit** — `git add -A site scripts tests package.json && git commit -m "feat(site): docs, privacy, served install files, prepare-site"`

---

### Task 11 : README anglais, fiches des catalogues, procédure de sortie

**Files:**
- Modify: `README.md`
- Create: `docs/release.md`, `docs/store/chrome-web-store.md`, `docs/store/extensions-gnome-org.md`

- [ ] **Step 1 : `README.md` en anglais** : pitch (une phrase), lien vers le site, `Install` (la commande + lien vers la page Docs), `Development` (structure du dépôt, `scripts/dev-install.sh`, `npm test`, `npm run build`, avertissement `GSETTINGS_BACKEND=memory` pour le Shell imbriqué), `Release` (lien `docs/release.md`), `License` (GPL-3.0-or-later). Les sections « Utilisation », « Choix de comportement », « Limites connues » vivent désormais sur le site : le README y renvoie.

- [ ] **Step 2 : `docs/release.md`** — liste ordonnée : (1) mettre `release.json` et les trois versions à jour (`npm test` le vérifie) ; (2) `npm run build` ; (3) `WEB_EXT_API_KEY=… scripts/sign-firefox.sh` (exige un `siteUrl` réel) ; (4) `npm run prepare-site` et commit des fichiers de `site/public/` ; (5) tag `vX.Y.Z`, GitHub Release portant `build/gnome/<uuid>.shell-extension.zip`, `build/deep-work-lock-chrome-X.Y.Z.zip`, le `.xpi` ; (6) envoyer le zip GNOME sur extensions.gnome.org (texte dans `docs/store/extensions-gnome-org.md`) ; (7) envoyer le zip Chrome sur le Chrome Web Store (texte dans `docs/store/chrome-web-store.md`) ; (8) déployer le site (Railway suit la branche `main`) ; (9) vérifier `curl -fsSL $SITE/install.sh | sh` sur une machine propre.

- [ ] **Step 3 : Fiches** : `docs/store/extensions-gnome-org.md` : description, justification de `unlock-dialog` (« the lock must survive the lock screen: the countdown keeps running and the desktop stays locked when the user comes back »), justification du script Python embarqué (native messaging host, source included, installed into the user's own config like GSConnect), capture à fournir. `docs/store/chrome-web-store.md` : nom, résumé (132 caractères max), description, catégorie Productivity, single purpose statement, justification par permission (`tabs`, `nativeMessaging`, `declarativeNetRequest`, `webNavigation`, `storage`, `<all_urls>`), URL de confidentialité `${siteUrl}/privacy`, visibilité « Unlisted », captures 1280×800 à fournir.

- [ ] **Step 4 : Relecture** — Run: `grep -rnE "[éèàçù]" README.md docs/release.md docs/store` — Expected: rien.

- [ ] **Step 5 : Commit** — `git add README.md docs && git commit -m "docs: english readme, store listings, release procedure"`

---

### Task 12 : Déploiement Railway et validation de bout en bout

**Files:** aucun changement de code attendu ; corrections éventuelles dans des commits séparés.

Cette tâche mêle des actions que seul l'auteur peut faire (comptes, domaine, sessions) et des vérifications. Elle se termine quand la commande publique a été exécutée avec succès sur une machine propre.

- [ ] **Step 1 : Projet Railway** — Run (depuis `site/`): `railway up` (crée le projet et le service, signe l'utilisateur si besoin) ; puis dans Railway : Root Directory = `site`, build par défaut (Railpack détecte Next + pnpm), `railway domain` pour l'URL provisoire. Expected: le site répond sur l'URL Railway ; `curl -fsSL <url>/install.sh | head -3` montre le script.

- [ ] **Step 2 : Quand le domaine existe** (action auteur) : mettre `siteUrl` dans `release.json`, `npm test`, `npm run prepare-site`, commit ; ajouter le domaine personnalisé dans Railway et le DNS ; `scripts/sign-firefox.sh` ; `npm run prepare-site` ; commit des `.xpi` et de `updates.json`.

- [ ] **Step 3 : Soumissions** (action auteur, avec les textes de `docs/store/`) : extensions.gnome.org (zip GNOME), Chrome Web Store (zip Chrome, non listé), passage du dépôt en public au préalable.

- [ ] **Step 4 : Validation Wayland sur la machine de l'auteur** : se connecter en session « GNOME » (Wayland) ; `scripts/dev-install.sh` ; rejouer : verrou de fenêtre, d'application, d'onglet Chrome et d'onglet Firefox ; fermeture de la cible (onglet rouvert, fenêtre : bureau vide) ; nouvelle fenêtre de navigateur refusée ; popup de connexion Google autorisée ; Super+L puis retour ; fin de session : réglages restaurés (`gsettings get org.gnome.mutter overlay-key` → `'Super_L'`). Puis tuer le Shell (`kill -9 $(pidof gnome-shell)`) pendant une session, se reconnecter : les réglages sont restaurés et aucun verrou ne reprend (règle de la tâche 4). Expected: identique au README pour chaque scénario.

- [ ] **Step 5 : Validation GNOME 48 ou 49** (machine virtuelle Fedora 43 ou Ubuntu 25.10, Wayland) : installer Chrome et/ou Firefox, exécuter la commande publique depuis le site ; Expected: boîte GNOME, mot de passe, puis `◉ Focus` sans déconnexion ; un verrou d'onglet fonctionne ; `uninstall.sh` remet tout en place (`/etc/firefox/policies/policies.json` absent ou sans notre entrée, manifestes supprimés).

- [ ] **Step 6 : Machine propre Ubuntu 24.04** (VM) : même parcours que l'étape 5 en X11 et en Wayland.

- [ ] **Step 7 : Clore** : noter dans `docs/release.md` la date et les versions approuvées par chaque catalogue ; ouvrir le site.
