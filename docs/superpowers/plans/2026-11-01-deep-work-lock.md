# Deep Work Lock — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un verrou de concentration GNOME/X11 qui enferme l'utilisateur dans une seule cible (fenêtre, application ou onglet Chrome) jusqu'à la fin d'un compte à rebours.

**Architecture:** Une extension GNOME Shell (GJS/ESM) porte le verrou bureau, le menu de la barre du haut et un service D-Bus. Une extension Chrome MV3 applique le verrou d'onglet. Un hôte de messagerie native Python fait le pont Chrome ⇄ D-Bus. Toute la logique de décision est isolée dans des modules purs testés avec `node --test` et `unittest` ; le code qui touche GNOME/Chrome est un câblage mince vérifié à la main.

**Tech Stack:** GJS ESM (GNOME Shell 46), Chrome MV3 (service worker ESM, `declarativeNetRequest`, `webNavigation`, `nativeMessaging`), Python 3.12 + PyGObject (`Gio` D-Bus), bash, Node 24 (`node --test`) pour les tests JS.

**Spec:** `docs/superpowers/specs/2026-11-01-deep-work-lock-design.md`

## Global Constraints

- Cible : Ubuntu 24.04, GNOME Shell 46, X11 ; Chrome 151 en .deb ; Python 3.12 ; Node 24.
- Aucune sortie anticipée : pas de bouton arrêter, pause, mot de passe, prolongation, délai de grâce.
- Durées : presets 25, 30, 45, 60, 90 min + valeur libre ; 30 par défaut. Valeur libre bornée à 1–600 min.
- Message de tentative de sortie : `🔒 Verrouillé · mm:ss restantes` (h:mm:ss au-delà d'une heure).
- Bouton : `Verrouiller N min`. Couleur d'accent `#e95420` (orange Ubuntu) pour l'icône active et le compte à rebours.
- Tout réglage modifié est sauvegardé sur disque **avant** d'être modifié, et restauré à la fin, au `disable()` et au chargement suivant.
- Super+L (media-keys `screensaver`) reste actif ; la session continue pendant l'écran verrouillé.
- Les dialogues, menus et popups de la cible restent utilisables.
- UUID de l'extension GNOME : `deep-work-lock@deepwork.local`. Noms D-Bus : `org.deepworklock.Shell` (`/org/deepworklock/Shell`) et `org.deepworklock.ChromeBridge` (`/org/deepworklock/ChromeBridge`). Hôte natif : `org.deepworklock.host`.
- Fichier d'état : `~/.local/state/deep-work-lock/session.json`.
- Code et commentaires en anglais, textes d'interface en français.

## Décisions de builder (section 7 de la spec)

- **Cible fermée** : la session continue (sinon Ctrl+W serait une sortie en 2 s). Onglet fermé → l'extension Chrome le rouvre sur la dernière URL autorisée. Fenêtre ou appli fermée → bureau vide ; une nouvelle fenêtre de la même application est acceptée et devient la cible.
- **Redémarrage de GNOME Shell** : si le fichier d'état existe, que le `boot_id` est le même et que l'échéance n'est pas passée, la session **reprend**. Sinon (redémarrage machine ou échéance passée) : restauration des réglages et suppression du fichier.
- **Correspondance X11 ⇄ Chrome** : titre X11 = `<titre de l'onglet actif> - Google Chrome[…]`. Appariement glouton unique par préfixe.
- **Popups légitimes** : une fenêtre Chrome de type `popup` ouverte par l'onglet verrouillé est autorisée. GNOME minimise d'abord toute nouvelle fenêtre Chrome, puis la libère si l'extension Chrome l'annonce (`ExpectChromeWindow`) dans les 3 s. Fenêtres incognito et DevTools détachées ne sont jamais annoncées, donc restent minimisées.
- **Même site** : domaine enregistrable (eTLD+1 approché : deux derniers labels, trois pour une liste courte de suffixes `co.uk`, `com.au`, `co.jp`, `com.br`, `co.nz`, `org.uk`, `gouv.fr`). Permet `docs.google.com` → `accounts.google.com`.
- **Son de fin** : `global.display.get_sound_player().play_from_theme('complete', …)`.
- **Cible fenêtre Chrome entière** : en plus du verrou bureau, Chrome ferme les nouveaux onglets et fenêtres (sauf popups des onglets de la fenêtre) et bloque `chrome://`.

## Review Focus

1. **Redémarrage de GNOME Shell en pleine session** (même boot) : la session reprend avec le temps restant ; après un vrai redémarrage, tout est restauré et aucune session ne reprend. → tests `decideStartup` (Task 1).
2. **Dialogues de la cible non transients** (Photoshop sous Wine, dialogues GTK sans `transient-for`) : autorisés s'ils sont de la même appli et de type dialogue/utilitaire. → test `isWindowAllowed allows same-app dialog` (Task 1).
3. **Redémarrage du service worker Chrome** (MV3 tue le worker au repos) : le verrou est relu depuis `chrome.storage.session` puis depuis GNOME (`GetLock`). → test `restoreLock prefers storage then shell` (Task 2) et vérification manuelle (Task 7).
4. **Onglet verrouillé fermé ou détaché dans une nouvelle fenêtre** : rouvert / remis dans la fenêtre verrouillée. → tests `decideTabRemoved`, `decideTabAttached` (Task 2).
5. **Fenêtre Chrome non annoncée** (Ctrl+N, incognito, DevTools détachées) : reste minimisée. → test `isWindowAllowed rejects unannounced chrome window` (Task 1).

---

## File Structure

```
package.json                         # "test": node --test + python unittest
gnome-extension/deep-work-lock@deepwork.local/
  metadata.json                      # shell-version ["46"], session-modes ["user","unlock-dialog"]
  extension.js                       # enable/disable, wires everything
  stylesheet.css
  lib/policy.js                      # PURE: durations, formatting, window policy, chrome matching, startup decision
  lib/keybindings.js                 # PURE: which gsettings keys to neutralize
  lib/stateStore.js                  # read/write session.json, boot id
  lib/settingsGuard.js               # apply/restore gsettings
  lib/windowGuard.js                 # focus + new-window enforcement
  lib/panel.js                       # PanelMenu button, menu, countdown, shields, OSD message
  lib/dbus.js                        # org.deepworklock.Shell service + ChromeBridge client
chrome-extension/
  manifest.json
  background.js                      # service worker wiring
  lock.js                            # PURE: site, tab/window/navigation decisions, DNR rule
native-host/
  deep_work_lock_host.py
  test_host.py
tests/policy.test.mjs  tests/keybindings.test.mjs  tests/lock.test.mjs
install.sh  uninstall.sh  README.md
```

---

### Task 1: Politique GNOME pure (`lib/policy.js`)

**Files:**
- Create: `package.json`, `gnome-extension/deep-work-lock@deepwork.local/lib/policy.js`
- Test: `tests/policy.test.mjs`

**Interfaces:**
- Produces:
  - `DURATION_PRESETS = [25, 30, 45, 60, 90]`, `DEFAULT_DURATION = 30`
  - `parseDuration(input: string|number) -> number|null` — entier 1..600, sinon `null`.
  - `formatRemaining(ms: number) -> string` — `"mm:ss"`, `"h:mm:ss"` si ≥ 1 h, arrondi au supérieur, jamais négatif.
  - `lockMessage(ms) -> string` — `"🔒 Verrouillé · " + formatRemaining(ms) + " restantes"`.
  - `isWindowAllowed(win: WinInfo, target: Target, ctx: {targetGone: boolean, announcedIds: Set<string>}) -> boolean`
    - `WinInfo = {id: string, appId: string|null, type: 'normal'|'dialog'|'modal_dialog'|'utility'|'splash'|'desktop'|'dock'|'other', overrideRedirect: boolean, transientChain: string[], isChrome: boolean, createdAfterLock: boolean}`
    - `Target = {kind: 'window'|'app'|'tab', windowId: string|null, appId: string|null}`
  - `matchChromeWindows(xwins: {id, title}[], cwins: {id: number, activeTitle: string}[]) -> Map<string, number>`
  - `decideStartup(state: object|null, bootId: string, nowMs: number) -> 'none'|'resume'|'restore'`

- [ ] **Step 1: Write the failing tests** (`tests/policy.test.mjs`, `node:test` + `node:assert/strict`)

```js
test('parseDuration', () => {
  assert.equal(parseDuration('45'), 45); assert.equal(parseDuration(' 12 '), 12);
  assert.equal(parseDuration('0'), null); assert.equal(parseDuration('601'), null);
  assert.equal(parseDuration('abc'), null); assert.equal(parseDuration('2.5'), null);
});
test('formatRemaining', () => {
  assert.equal(formatRemaining(30*60000), '30:00'); assert.equal(formatRemaining(61500), '01:02');
  assert.equal(formatRemaining(-5), '00:00'); assert.equal(formatRemaining(90*60000), '1:30:00');
});
test('lockMessage', () => assert.equal(lockMessage(754000), '🔒 Verrouillé · 12:34 restantes'));
// isWindowAllowed — win(overrides) builds a default normal window of app 'x'
test('override-redirect and the target itself are allowed');
test('transient of target is allowed');                  // transientChain: ['T']
test('isWindowAllowed allows same-app dialog');          // window target, type 'dialog', appId same
test('other app normal window rejected');
test('app target allows any window of the app');
test('desktop window is never allowed');                 // type 'desktop' → false (focus goes back)
test('window target gone: new same-app normal window allowed'); // targetGone true
test('isWindowAllowed rejects unannounced chrome window'); // tab target, isChrome, createdAfterLock, not announced → false; announced → true
test('matchChromeWindows', () => {
  const m = matchChromeWindows(
    [{id:'a', title:'Article - Google Docs - Google Chrome'}, {id:'b', title:'YouTube - Google Chrome'}, {id:'c', title:'Terminal'}],
    [{id: 7, activeTitle:'YouTube'}, {id: 9, activeTitle:'Article - Google Docs'}]);
  assert.deepEqual([...m], [['a', 9], ['b', 7]]);
});
test('decideStartup', () => {
  assert.equal(decideStartup(null, 'B1', 0), 'none');
  assert.equal(decideStartup({bootId:'B1', endsAt: 1000}, 'B1', 500), 'resume');
  assert.equal(decideStartup({bootId:'B1', endsAt: 1000}, 'B1', 1500), 'restore');
  assert.equal(decideStartup({bootId:'B0', endsAt: 1000}, 'B1', 500), 'restore');
});
```

- [ ] **Step 2:** Run `npm test` → FAIL (module not found).
- [ ] **Step 3: Implement `policy.js`** — no `gi://` import. Window rule order: overrideRedirect → true; desktop → false; id === target.windowId → true; transientChain includes target.windowId → true; app target and same appId → true; window target and same appId and type in {dialog, modal_dialog, utility, splash} → true; window target, targetGone, same appId → true; tab target and isChrome and createdAfterLock → `announcedIds.has(id)`; tab target and same appId and type dialog-ish → true; else false. Matching: for each Chrome window, the unique unclaimed X11 window whose title starts with `activeTitle + ' - '` and contains `Google Chrome`; longest activeTitle first.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(gnome): pure lock policy`.

### Task 2: Politique Chrome pure (`chrome-extension/lock.js`)

**Files:** Create `chrome-extension/lock.js`; Test `tests/lock.test.mjs`

**Interfaces:**
- Produces:
  - `siteOf(url: string) -> string|null` — domaine enregistrable pour http(s), `null` sinon.
  - `isInternalUrl(url) -> boolean` — vrai pour tout schéma autre que http, https, about:blank, data, blob.
  - `Lock = {kind: 'tab'|'window', tabId: number|null, windowId: number, site: string|null, lastUrl: string|null, endsAt: number}`
  - `decideNewTab(lock, tab: {id, windowId, openerTabId}) -> 'allow'|'close'` — tab : tout nouvel onglet fermé ; window : fermé si dans la fenêtre verrouillée (les autres fenêtres sont gérées par GNOME), sinon `'allow'`.
  - `decideNewWindow(lock, win: {id, type}, firstTab: {openerTabId, windowId}|null, lockedTabIdsInWindow: number[]) -> 'allow-popup'|'close'`
  - `decideNavigation(lock, tabId, url) -> 'allow'|'revert'` — seulement l'onglet verrouillé (tab) ou un onglet de la fenêtre (window) ; revert si interne, ou (kind tab) site différent.
  - `decideTabRemoved(lock, tabId, windowClosing) -> {action: 'none'|'reopen', url?, inWindow?: number|null}`
  - `decideTabAttached(lock, tabId, newWindowId) -> {action: 'none'|'move-back'}`
  - `dnrRules(lock) -> object[]` — règle de session id 1 : `{action:{type:'block'}, condition:{tabIds:[tabId], resourceTypes:['main_frame'], excludedRequestDomains:[site]}}` pour kind tab, `[]` sinon.
  - `restoreLock(fromStorage: Lock|null, fromShell: Lock|null, nowMs) -> Lock|null` — préfère storage, ignore expiré.

- [ ] **Step 1: Write failing tests** — `siteOf('https://docs.google.com/x') === 'google.com'`, `siteOf('https://www.bbc.co.uk') === 'bbc.co.uk'`, `siteOf('chrome://settings') === null`; `isInternalUrl('chrome://extensions')`, `isInternalUrl('devtools://x')`, `!isInternalUrl('https://a.com')`; `decideNavigation(tabLock(site 'google.com'), 5, 'https://accounts.google.com')==='allow'`, `… 'https://claude.ai' === 'revert'`, `… 'chrome://newtab' === 'revert'`, other tab id → `'allow'`; `decideNewWindow` popup with opener 5 → `'allow-popup'`, normal → `'close'`; `decideTabRemoved(lock, 5, false)` → `{action:'reopen', url: lastUrl, inWindow: windowId}`, windowClosing → `inWindow: null`; `decideTabAttached(lock, 5, 99)` → move-back; `dnrRules` exact object; `restoreLock prefers storage then shell` (storage wins, shell used when storage null, expired → null).
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement (no `chrome.*` access in this file).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(chrome): pure tab lock policy`.

### Task 3: Hôte de messagerie native (`native-host/deep_work_lock_host.py`)

**Files:** Create `native-host/deep_work_lock_host.py`; Test `native-host/test_host.py`

**Interfaces:**
- Wire protocol Chrome ⇄ host: JSON, 4-byte native-endian length prefix.
  - host → Chrome: `{id, type: 'listWindows'|'lock'|'unlock', payload}` ; Chrome répond `{replyTo: id, ok, data}`.
  - Chrome → host: `{type: 'getLock'}` (host répond `{type:'lockState', data}`), `{type: 'expectWindow', reason}`, `{type: 'hello'}`.
- D-Bus exported by host, `org.deepworklock.ChromeBridge`: `ListWindows() -> s`, `Lock(s json) -> s`, `Unlock() -> s`. Chaque appel transmis à Chrome ; réponse JSON `data` ou erreur D-Bus après 3 s.
- Consumes `org.deepworklock.Shell`: `GetLock() -> s`, `ExpectChromeWindow(s reason)`.
- Pure helpers: `encode_message(obj) -> bytes`, `FrameReader.feed(bytes) -> list[dict]`, `PendingRequests` (`add(invocation) -> id`, `resolve(id, msg) -> invocation|None`, `expire(now) -> list`).

- [ ] **Step 1:** Tests: round-trip encode/feed, feed in two partial chunks yields one message, two messages in one chunk yields two, `PendingRequests` resolve unknown id → None, expire after 3 s.
- [ ] **Step 2:** `python3 -m unittest native-host/test_host.py` → FAIL.
- [ ] **Step 3:** Implement with `GLib.MainLoop`, `GLib.io_add_watch` on stdin (fd 0, raw `os.read`), `Gio.bus_own_name` with `REPLACE|ALLOW_REPLACEMENT`, `register_object` from introspection XML. Exit when stdin hits EOF. Logs to stderr only.
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5:** Commit `feat(host): native messaging bridge`.

### Task 4: Extension Chrome (câblage)

**Files:** Create `chrome-extension/manifest.json`, `chrome-extension/background.js`

**Interfaces:**
- Consumes Task 2 (`lock.js`), Task 3 protocol.
- manifest: MV3, `"background": {"service_worker": "background.js", "type": "module"}`, permissions `tabs`, `nativeMessaging`, `declarativeNetRequest`, `webNavigation`, `storage`; `host_permissions: ["<all_urls>"]`; fixed `"key"` so the extension id is stable (id written in host manifest by `install.sh`).

- [ ] **Step 1:** Implement `background.js`: `connectNative('org.deepworklock.host')` with reconnect (1 s → 30 s backoff); on startup `restoreLock(storage.session, getLock reply)`; handlers `listWindows` (windows with `activeTitle` + tabs `{id,title,url,favIconUrl}`), `lock` (activate tab, focus window, compute site/lastUrl, store, apply DNR, reply `{ok, site, url, windowId}`), `unlock` (clear storage, remove DNR rule 1). Listeners: `tabs.onCreated`, `windows.onCreated` (popup → send `expectWindow`), `tabs.onActivated` (re-activate locked tab), `windows.onFocusChanged`, `tabs.onUpdated` + `webNavigation.onCommitted` (revert → `tabs.update(lastUrl)`; else update `lastUrl`), `tabs.onRemoved` (reopen + `expectWindow('relocated')` if new window), `tabs.onAttached`. Auto-unlock when `Date.now() > endsAt` via `chrome.alarms`-free check on each event.
- [ ] **Step 2:** `node --check chrome-extension/background.js` and JSON validity → OK.
- [ ] **Step 3:** Commit `feat(chrome): MV3 service worker`.

### Task 5: Sauvegarde/restauration des réglages GNOME

**Files:** Create `lib/keybindings.js`, `lib/stateStore.js`, `lib/settingsGuard.js`; Test `tests/keybindings.test.mjs`

**Interfaces:**
- `keybindings.js` (pure): `neutralizePlan(schemaKeys: Record<schemaId, string[]>) -> Array<{schema, key, value}>` :
  - `org.gnome.desktop.wm.keybindings` : toutes les clés → `[]` sauf `close, maximize, unmaximize, toggle-maximized, toggle-fullscreen, begin-move, begin-resize, minimize`.
  - `org.gnome.shell.keybindings` : toutes → `[]` sauf `screenshot, screenshot-window, show-screenshot-ui`.
  - `org.gnome.mutter.keybindings` : aucune modifiée.
  - `org.gnome.settings-daemon.plugins.media-keys` : `terminal, logout, home, www, email, calculator, search, control-center, help` (+ variantes `-static` présentes) → `[]` ; `custom-keybindings` → `[]`. `screensaver` intact.
  - `org.gnome.mutter overlay-key` → `''` ; `org.gnome.desktop.interface enable-hot-corners` → `false` ; `org.gnome.desktop.notifications show-banners` → `false` ; `org.gnome.shell.extensions.dash-to-dock hot-keys` → `false` (si le schéma existe).
- `stateStore.js`: `STATE_PATH`, `readState() -> object|null`, `writeState(obj)` (atomic `replace_contents`), `clearState()`, `currentBootId() -> string`.
- `settingsGuard.js`: `class SettingsGuard { apply(): saved; restore(saved) }` — `saved = [{schema, key, userValue: string|null}]` (GVariant `print(true)`, `null` = valeur par défaut → `reset`). `apply()` capture d'abord, écrit l'état (fourni par l'appelant via callback `onSaved(saved)`), puis modifie. Schémas absents ignorés (`Gio.SettingsSchemaSource.lookup`).

- [ ] **Step 1:** Test `neutralizePlan`: wm `switch-applications` → `[]`, `close` absent du plan, shell `toggle-overview` → `[]`, `screenshot` absent, media-keys `terminal` → `[]`, `screensaver` absent, overlay-key `''` présent.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS (+ `node --check` des modules GJS).
- [ ] **Step 5:** Commit `feat(gnome): settings save/restore`.

### Task 6: Garde des fenêtres (`lib/windowGuard.js`)

**Files:** Create `lib/windowGuard.js`

**Interfaces:**
- Consumes `isWindowAllowed`, `WinInfo`, `Target` (Task 1).
- Produces `class WindowGuard { constructor({onBlocked: () => void}); start(target: Target, lockStartMs); stop(); expectChromeWindow(reason); get target(); findTargetWindows() -> Meta.Window[]; activateTarget() }`.
- Window ids: X11 XID from `win.get_description()` (stable across shell restarts). `appId` from `Shell.WindowTracker.get_default().get_window_app(win)?.get_id()`. `isChrome`: `wm_class` matches `/google-chrome/i`.

- [ ] **Step 1:** Implement: connect `global.display` `notify::focus-window` (idle → if not allowed: minimize offender unless desktop, `activateTarget()`, `onBlocked()`), `window-created` (idle → if not allowed: minimize, track; Chrome window in tab mode → push to pending list with timestamp), `global.workspace_manager` `active-workspace-changed` → `activateTarget()`, target `notify::minimized` → unminimize, `unmanaged` on target → `targetGone = true`. `expectChromeWindow`: newest pending Chrome window < 3 s → add to `announcedIds`, unminimize, activate; if `targetGone` or reason `relocated`, it becomes `target.windowId`. When no allowed window remains, do nothing (no loop).
- [ ] **Step 2:** `node --check` OK.
- [ ] **Step 3:** Commit `feat(gnome): window guard`.

### Task 7: Panneau, D-Bus et câblage de l'extension

**Files:** Create `metadata.json`, `extension.js`, `stylesheet.css`, `lib/panel.js`, `lib/dbus.js`

**Interfaces:**
- Consumes Tasks 1, 5, 6 ; ChromeBridge (Task 3).
- `dbus.js`: `class ShellService { constructor({getLock: () => object|null, expectChromeWindow: (reason) => void}); export(); unexport() }` (interface `org.deepworklock.Shell`, `GetLock() -> s`, `ExpectChromeWindow(s)`), `chromeCall(method: 'ListWindows'|'Lock'|'Unlock', arg?: object) -> Promise<object>` (timeout 3 s, rejette si l'hôte est absent).
- `panel.js`: `class FocusIndicator extends PanelMenu.Button` — `setIdle()`, `setLocked(endsAt)`, `tick(remainingMs)`, `refreshTargets()` ; émet le callback `onLock({minutes, target})`. `target` côté UI : `{kind:'window', metaWindow}`, `{kind:'app', appId}`, `{kind:'tab', chromeWindowId, tabId, metaWindow}`.
- `extension.js`: `enable()` → `decideStartup` (resume / restore / none), export D-Bus, indicator ; `lock()` → écrit l'état `{bootId, startedAt, endsAt, target (serialisable: kind, windowId XID, appId, tabId, chromeWindowId), saved}` puis `SettingsGuard.apply`, `WindowGuard.start`, shields, Chrome `Lock` si tab ou fenêtre Chrome ; tick 1 s ; fin → son, `Chrome Unlock`, `restore`, `clearState`. `disable()` → si session : restore réglages mais **garde** le fichier d'état si l'échéance n'est pas passée (pour qu'un redémarrage du Shell reprenne), retire tout le reste.

- [ ] **Step 1:** Implement menu: chips 25/30/45/60/90 + champ libre (`St.Entry`, validé par `parseDuration`), liste des fenêtres (icône d'appli, titre, libellé `fenêtre`) ; pour chaque appli avec ≥ 1 fenêtre une ligne `app` ; fenêtres Chrome dépliables (`PopupSubMenuMenuItem`) listant les onglets via `chromeCall('ListWindows')` + `matchChromeWindows` ; si l'hôte ne répond pas : ligne grisée « Extension Chrome non connectée ». Bouton `Verrouiller N min` désactivé tant qu'aucune cible.
- [ ] **Step 2:** Session : label orange `mm:ss` dans l'icône, menu fermé et insensible, opacité 90/255 sur `_leftBox`, `_centerBox` et les autres enfants de `_rightBox`, boucliers `St.Widget` réactifs transparents au-dessus de `Main.panel` et du conteneur `dashtodockContainer` (suivi de `notify::allocation`), clic → message ; `Main.overview.show/toggle/showApps` remplacés par un appel au message (restaurés à la fin) ; `Main.sessionMode` `updated` : pendant `unlock-dialog` la garde de focus est suspendue, au retour elle reprend et l'indicateur est réaffiché. Message : `Main.osdWindowManager.show(-1, Gio.ThemedIcon('changes-prevent-symbolic'), lockMessage(ms))`, au plus une fois par seconde.
- [ ] **Step 3:** `node --check` de tous les modules, JSON valide.
- [ ] **Step 4: Vérification en direct** (Task 8 installée) : session 2 min sur un terminal → Alt+Tab, Super, clic dock, Ctrl+Alt+T, nouvelle fenêtre : tous bloqués avec message ; fin : `gsettings get org.gnome.mutter overlay-key` = `'Super_L'`, Alt+Tab fonctionne.
- [ ] **Step 5:** Commit `feat(gnome): panel, D-Bus service and wiring`.

### Task 8: Installation, désinstallation, README

**Files:** Create `install.sh`, `uninstall.sh`, `README.md`

- [ ] **Step 1:** `install.sh` : copie l'extension dans `~/.local/share/gnome-shell/extensions/deep-work-lock@deepwork.local`, `gnome-extensions enable` (avertit qu'un redémarrage du Shell/session peut être nécessaire en X11 pour la découverte), copie l'hôte dans `~/.local/share/deep-work-lock/`, écrit `~/.config/google-chrome/NativeMessagingHosts/org.deepworklock.host.json` (`allowed_origins: ["chrome-extension://<ID>/"]`, ID calculé depuis la clé du manifeste), affiche les étapes « chrome://extensions → mode développeur → Charger l'extension non empaquetée → `chrome-extension/` ».
- [ ] **Step 2:** `uninstall.sh` : si `session.json` existe, restaure chaque `saved` via `gsettings set/reset` (python3 inline lisant le JSON), supprime l'état, désactive et supprime l'extension, supprime hôte et manifeste.
- [ ] **Step 3:** `bash -n` sur les deux scripts ; exécuter `install.sh` ; vérifier fichiers en place.
- [ ] **Step 4:** Commit `feat: install and uninstall scripts`.
