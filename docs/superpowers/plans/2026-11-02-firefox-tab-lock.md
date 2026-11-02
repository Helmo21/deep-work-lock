# Deep Work Lock pour Firefox — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verrouiller un onglet ou une fenêtre Firefox exactement comme un onglet ou une fenêtre Chrome, les deux navigateurs connectés en parallèle.

**Architecture:** Une seule base de code d'extension (`chrome-extension/`) ; un script Node construit `build/firefox/` avec un manifeste dérivé. Un seul hôte Python qui reconnaît son navigateur à ses arguments et prend un nom D-Bus par navigateur. Côté GNOME, ce qui était propre à Chrome devient une table `BROWSERS` dans `policy.js` ; la cible d'une session porte `browser`.

**Tech Stack:** inchangé depuis la V1 (GJS GNOME 46, MV3, Python 3.12 + PyGObject, Node 24) + Firefox 156 snap, `web-ext@10.7.0` via `npx`.

**Spec:** `docs/superpowers/specs/2026-11-02-firefox-tab-lock-design.md` (prolonge `docs/superpowers/specs/2026-11-01-deep-work-lock-design.md`)

## Global Constraints

- Firefox 156.0.1 snap ; messagerie native via le portail `org.freedesktop.portal.WebExtensions`.
- Identifiant gecko définitif : `deep-work-lock@deepwork.local`. `strict_min_version` : `"140.0"`. `data_collection_permissions: {required: ["none"]}`. Pas de champ `key` dans le manifeste Firefox.
- Noms D-Bus : `org.deepworklock.ChromeBridge` (`/org/deepworklock/ChromeBridge`, inchangé) et `org.deepworklock.FirefoxBridge` (`/org/deepworklock/FirefoxBridge`). Méthodes `ListWindows` / `Lock` / `Unlock` identiques.
- Manifeste d'hôte Firefox : `~/.mozilla/native-messaging-hosts/org.deepworklock.host.json`, `allowed_extensions: ["deep-work-lock@deepwork.local"]`. Le manifeste Chrome ne change pas.
- Titres X11 : Chrome `<titre> - Google Chrome` ; Firefox `<titre> — Mozilla Firefox` (U+2014 entouré d'espaces). `WM_CLASS` Firefox : `"Navigator", "firefox_firefox"`.
- Message menu : `Extension Firefox non connectée : onglets indisponibles` (et l'équivalent Chrome existant).
- `chrome-extension/` reste chargeable tel quel par Chrome. Clés Mozilla jamais dans le dépôt ; `.xpi` non versionné.
- Code et commentaires en anglais, textes d'interface en français.

## Résultats du test de faisabilité (fait avant le plan)

- Firefox snap lance l'hôte via le portail avec `argv = [hôte, '<chemin du manifeste>.json', 'deep-work-lock@deepwork.local']` ; l'hôte joint le bus de session. ✔
- **Le portail demande une autorisation par nom d'hôte** ; un délai sans réponse est enregistré comme refus définitif (la fenêtre de demande peut ne pas s'afficher). → `install.sh` écrit l'autorisation `webextensions / org.deepworklock.host / snap.firefox = yes` dans le PermissionStore, en l'annonçant ; `uninstall.sh` la retire.
- `storage.session`, règles de session DNR avec `tabIds` + `excludedRequestDomains` : OK. ✔
- **`windows.onCreated.addListener(fn, {windowTypes})` lève une exception dans Firefox** → enregistrer sans filtre si le filtre est refusé.
- `windows.get` donne exactement le rectangle X11 de la fenêtre (même x, y, largeur, hauteur).
- La page d'événements reste en vie > 100 s avec un port natif actif ; l'hôte envoie quand même `{"type":"ping"}` toutes les 20 s pour ne pas dépendre de ce comportement.

## Décisions de builder (section 7 de la spec)

- **Fichiers partagés** : `chrome-extension/` est la source. `scripts/build-firefox.mjs` écrit `build/firefox/` (manifeste dérivé + copie de `lock.js`, `background.js`). `build/` est visible du snap (sous `$HOME`, non caché).
- **Navigateur de l'extension** : `BROWSER = chrome.runtime.getURL('').startsWith('moz-extension:') ? 'firefox' : 'chrome'`.
- **GetLock** renvoie `{active, endsAt, browser, lock, chrome}` ; `chrome` (= `lock` si `browser === 'chrome'`, sinon `null`) garde compatibles l'ancienne extension Chrome. L'extension prend `lock` seulement si `browser` est le sien (`shellLockFor`).
- **Annonces** : nouvelle méthode Shell `ExpectWindow(s detail)` avec `{browser, reason, bounds}` ; `ExpectChromeWindow(s)` gardée comme alias (`browser: 'chrome'`) pour l'hôte V1 encore en cours d'exécution.
- **Firefox qui redémarre** : `storage.session` est vide, GNOME a encore le verrou. L'extension, sur le verrou venu de GNOME, appelle `decideRecovery` : garder l'onglet s'il existe encore sur le même site, sinon adopter un onglet restauré (même URL, puis même site, actif d'abord), sinon rouvrir `lastUrl` dans une nouvelle fenêtre. Puis elle annonce la fenêtre (`relocated`, avec ses coordonnées). Côté GNOME, une annonce **avec coordonnées** peut libérer une fenêtre de ce navigateur cachée depuis jusqu'à 60 s (`RECOVERY_WINDOW_MS`) ; sans coordonnées, 3 s comme avant.
- **Verrou de fenêtre de navigateur** : une nouvelle fenêtre de navigateur ne remplace la cible fermée que si son extension l'a annoncée (règle plus stricte de la spec 5.3, Chrome et Firefox).
- **Fichier d'état** : version 2, `target.browser`, `target.browserWindowId`, `browserLock`. `upgradeState` convertit un fichier V1 (`target.chromeWindowId`, `chrome`).

## Review Focus

1. **Fichier d'état V1 pendant la mise à jour** (session commencée avant) : reprise avec `browser: 'chrome'` et l'ancien verrou Chrome. → test `upgradeState converts a V1 file` (Task 1).
2. **Firefox qui redémarre pendant un verrou d'onglet** : onglet adopté ou rouvert, fenêtre annoncée tard (> 3 s) mais libérée car les coordonnées correspondent. → tests `decideRecovery …` (Task 3), `pickAnnounced accepts a late announcement with bounds` (Task 1).
3. **Annonce d'un navigateur appliquée à l'autre** : une annonce Firefox ne libère jamais une fenêtre Chrome. → test `pickAnnounced ignores other browsers` (Task 1).
4. **Mode de dépannage / nouvelle fenêtre de navigateur après fermeture de la cible fenêtre** : reste cachée sans annonce. → test `browser window target gone: only announced windows replace it` (Task 1).
5. **Identifiants d'onglets identiques dans les deux navigateurs** (Chrome et Firefox ont tous deux un onglet 1) : sélections distinctes dans le menu. → clés `tab:<browser>:<id>` (Task 4), vérification manuelle (Task 6).

---

## File Structure

```
chrome-extension/lock.js            # + shellLockFor, decideRecovery
chrome-extension/background.js      # BROWSER, onCreated sans filtre, récupération
scripts/build-firefox.mjs           # firefoxManifest() pur + CLI → build/firefox/
scripts/sign-firefox.sh             # build + web-ext sign --channel unlisted
native-host/deep_work_lock_host.py  # detect_browser, bridge par navigateur, ExpectWindow, ping
gnome-extension/.../lib/policy.js   # BROWSERS, browserOfWmClass, matchBrowserWindows, pickAnnounced, parseExpect, upgradeState
gnome-extension/.../lib/dbus.js     # ExpectWindow, browserCall
gnome-extension/.../lib/windowGuard.js, lib/panel.js, extension.js
install.sh, uninstall.sh, README.md, .gitignore, package.json
tests/policy.test.mjs, tests/lock.test.mjs, tests/firefox-manifest.test.mjs, native-host/test_host.py
```

---

### Task 1: Politique GNOME générique (pur)

**Files:**
- Modify: `gnome-extension/deep-work-lock@deepwork.local/lib/policy.js`
- Test: `tests/policy.test.mjs`

**Interfaces:**
- Produces:
  - `BROWSERS: {chrome, firefox}`, chaque entrée `{id, name, wmClass: RegExp, titleSeparator, titleSuffix, bridgeName, bridgePath, icon}` ; Chrome `{name:'Chrome', wmClass:/google-chrome/i, titleSeparator:' - ', titleSuffix:'Google Chrome', bridgeName:'org.deepworklock.ChromeBridge', bridgePath:'/org/deepworklock/ChromeBridge', icon:'google-chrome'}` ; Firefox `{name:'Firefox', wmClass:/firefox/i, titleSeparator:' — ', titleSuffix:'Mozilla Firefox', bridgeName:'org.deepworklock.FirefoxBridge', bridgePath:'/org/deepworklock/FirefoxBridge', icon:'firefox'}`.
  - `browserOfWmClass(wmClass, wmClassInstance) -> 'chrome'|'firefox'|null`
  - `matchBrowserWindows(xwins, bwins, browser) -> Map<xid, browserWindowId>` (remplace `matchChromeWindows`)
  - `isWindowAllowed(win, target, ctx)` : `win.isChrome` devient `win.browser` (`string|null`).
  - `ANNOUNCE_WINDOW_MS = 3000`, `RECOVERY_WINDOW_MS = 60000`, `BOUNDS_TOLERANCE_PX = 60`
  - `boundsMatch(rect {x,y,width,height}, bounds {left,top,width,height}|null) -> bool`
  - `pickAnnounced(candidates [{browser, time, rect}], {browser, bounds}, nowMs) -> index|-1` (le plus récent qui convient)
  - `parseExpect(detail: string, defaultBrowser='chrome') -> {browser, reason, bounds}`
  - `upgradeState(state) -> state` (v2)

- [ ] **Step 1: Write the failing tests** (remplacer les tests `matchChromeWindows` et `isChrome`)

```js
test('browserOfWmClass', () => {
    assert.equal(browserOfWmClass('Google-chrome', 'google-chrome'), 'chrome');
    assert.equal(browserOfWmClass('firefox_firefox', 'Navigator'), 'firefox');
    assert.equal(browserOfWmClass('Gnome-terminal', 'gnome-terminal'), null);
    assert.equal(browserOfWmClass(null, null), null);
});
test('matchBrowserWindows: chrome titles', /* les 3 anciens cas matchChromeWindows, 3e arg 'chrome' */);
test('matchBrowserWindows: firefox em dash', () => {
    const m = matchBrowserWindows(
        [{id: 'a', title: 'Article - Docs — Mozilla Firefox'}, {id: 'b', title: 'YouTube — Mozilla Firefox'},
            {id: 'c', title: 'YouTube - Google Chrome'}],
        [{id: 1, activeTitle: 'YouTube'}, {id: 2, activeTitle: 'Article - Docs'}], 'firefox');
    assert.deepEqual([...m].sort(), [['a', 2], ['b', 1]]);
});
test('matchBrowserWindows: firefox short title not confused', () => {
    const m = matchBrowserWindows(
        [{id: 'a', title: 'A — B — Mozilla Firefox'}, {id: 'b', title: 'A — Mozilla Firefox'}],
        [{id: 1, activeTitle: 'A'}, {id: 2, activeTitle: 'A — B'}], 'firefox');
    assert.deepEqual([...m].sort(), [['a', 2], ['b', 1]]);
});
test('isWindowAllowed rejects unannounced browser window', /* ancien test, isChrome:true → browser:'chrome', + même chose avec 'firefox' */);
test('browser window target gone: only announced windows replace it', () => {
    const t = {kind: 'window', windowId: 'T', appId: 'firefox_firefox.desktop'};
    const f = win({id: 'N', appId: 'firefox_firefox.desktop', browser: 'firefox', createdAfterLock: true});
    assert.equal(isWindowAllowed(f, t, ctx({targetGone: true})), false);
    assert.equal(isWindowAllowed(f, t, ctx({targetGone: true, announcedIds: new Set(['N'])})), true);
    // non-browser apps keep the V1 rule
    assert.equal(isWindowAllowed(win({id: 'N', createdAfterLock: true}), winTarget, ctx({targetGone: true})), true);
});
test('pickAnnounced', () => {
    const r = {x: 140, y: 109, width: 1332, height: 1092};
    const b = {left: 140, top: 109, width: 1332, height: 1092};
    const c = [{browser: 'firefox', time: 0, rect: r}, {browser: 'firefox', time: 1000, rect: {x: 0, y: 0, width: 10, height: 10}}];
    assert.equal(pickAnnounced(c, {browser: 'firefox', bounds: null}, 2000), 1);   // newest
    assert.equal(pickAnnounced(c, {browser: 'firefox', bounds: b}, 2000), 0);      // by bounds
});
test('pickAnnounced accepts a late announcement with bounds', () => {
    const r = {x: 140, y: 109, width: 1332, height: 1092};
    const c = [{browser: 'firefox', time: 0, rect: r}];
    assert.equal(pickAnnounced(c, {browser: 'firefox', bounds: null}, 5000), -1);
    assert.equal(pickAnnounced(c, {browser: 'firefox', bounds: {left: 150, top: 100, width: 1340, height: 1080}}, 30000), 0);
    assert.equal(pickAnnounced(c, {browser: 'firefox', bounds: {left: 140, top: 109, width: 1332, height: 1092}}, 61000), -1);
});
test('pickAnnounced ignores other browsers', () => {
    const c = [{browser: 'chrome', time: 0, rect: {x: 0, y: 0, width: 5, height: 5}}];
    assert.equal(pickAnnounced(c, {browser: 'firefox', bounds: null}, 100), -1);
});
test('parseExpect', () => {
    assert.deepEqual(parseExpect('{"browser":"firefox","reason":"relocated","bounds":null}'),
        {browser: 'firefox', reason: 'relocated', bounds: null});
    assert.deepEqual(parseExpect('{"reason":"popup"}'), {browser: 'chrome', reason: 'popup', bounds: null});
    assert.deepEqual(parseExpect('popup'), {browser: 'chrome', reason: 'popup', bounds: null});
    assert.equal(parseExpect('{"browser":"opera"}').browser, 'chrome');
});
test('upgradeState converts a V1 file', () => {
    const v1 = {version: 1, bootId: 'B', endsAt: 9, target: {kind: 'tab', windowId: '0x1', appId: 'google-chrome.desktop',
        tabId: 5, chromeWindowId: 2, label: 'x'}, chrome: {kind: 'tab', tabId: 5}, saved: []};
    const v2 = upgradeState(v1);
    assert.equal(v2.version, 2);
    assert.equal(v2.target.browser, 'chrome');
    assert.equal(v2.target.browserWindowId, 2);
    assert.deepEqual(v2.browserLock, {kind: 'tab', tabId: 5});
    assert.equal('chrome' in v2, false);
    const plain = upgradeState({version: 1, target: {kind: 'window', windowId: '0x2', appId: 'a', tabId: null, chromeWindowId: null}, chrome: null});
    assert.equal(plain.target.browser, null);
    assert.equal(upgradeState(null), null);
    assert.equal(upgradeState(v2), v2);
});
```

- [ ] **Step 2:** `node --test tests/policy.test.mjs` → FAIL (exports manquants).
- [ ] **Step 3:** Implémenter. `matchBrowserWindows` reprend l'algorithme de `matchChromeWindows` avec `prefix = activeTitle + sep` et `title.includes(titleSuffix)`. Dans `isWindowAllowed`, cas `window` : `if (win.browser && sameApp) return false` avant la règle `targetGone` (les fenêtres annoncées sont déjà acceptées plus haut ; les dialogues restent acceptés avant). `parseExpect` : navigateur inconnu → `defaultBrowser`.
- [ ] **Step 4:** `node --test tests/policy.test.mjs` → PASS.
- [ ] **Step 5:** Commit `feat(gnome): browser table and generic window matching`.

### Task 2: Hôte natif pour les deux navigateurs

**Files:**
- Modify: `native-host/deep_work_lock_host.py`
- Test: `native-host/test_host.py`

**Interfaces:**
- Produces: `detect_browser(argv) -> 'chrome'|'firefox'` ; `BRIDGES = {'chrome': ('org.deepworklock.ChromeBridge', '/org/deepworklock/ChromeBridge'), 'firefox': ('org.deepworklock.FirefoxBridge', '/org/deepworklock/FirefoxBridge')}` ; `bridge_xml(name) -> str` ; `expect_window_detail(browser, message) -> dict` ; `PING_INTERVAL_S = 20`.
- Le message vers l'extension `{"type": "ping"}` ; D-Bus Shell `ExpectWindow(s)` avec `json.dumps(expect_window_detail(...))`.

- [ ] **Step 1: Write the failing tests**

```python
class DetectBrowserTest(unittest.TestCase):
    def test_chrome(self):
        self.assertEqual(detect_browser(["h", "chrome-extension://abc/"]), "chrome")
    def test_firefox(self):
        self.assertEqual(detect_browser(["h", "/home/u/.mozilla/native-messaging-hosts/org.deepworklock.host.json",
                                         "deep-work-lock@deepwork.local"]), "firefox")
    def test_unknown_defaults_to_chrome(self):
        self.assertEqual(detect_browser(["h"]), "chrome")

class BridgeTest(unittest.TestCase):
    def test_names(self):
        self.assertEqual(BRIDGES["firefox"], ("org.deepworklock.FirefoxBridge", "/org/deepworklock/FirefoxBridge"))
        self.assertEqual(BRIDGES["chrome"][0], "org.deepworklock.ChromeBridge")
    def test_xml_uses_name(self):
        xml = bridge_xml("org.deepworklock.FirefoxBridge")
        self.assertIn('interface name="org.deepworklock.FirefoxBridge"', xml)
        for m in ("ListWindows", "Lock", "Unlock"):
            self.assertIn(f'name="{m}"', xml)
    def test_expect_detail(self):
        self.assertEqual(expect_window_detail("firefox", {"type": "expectWindow", "reason": "relocated",
                                                          "bounds": {"left": 1}}),
                         {"browser": "firefox", "reason": "relocated", "bounds": {"left": 1}})
        self.assertEqual(expect_window_detail("chrome", {})["reason"], "popup")
```

- [ ] **Step 2:** `python3 -m unittest discover -s native-host -p 'test_*.py'` → FAIL (ImportError).
- [ ] **Step 3:** Implémenter. `detect_browser` : un argument commençant par `chrome-extension://` → chrome ; sinon `len(argv) >= 3 and argv[1].endswith('.json')` → firefox ; sinon chrome. `Bridge.__init__(browser)` ; `run()` enregistre `BRIDGES[browser]` ; `GLib.timeout_add_seconds(PING_INTERVAL_S, …)` envoie le ping ; `expectWindow` appelle `ExpectWindow`. Logs « Chrome »/« Firefox » via le navigateur.
- [ ] **Step 4:** tests → PASS.
- [ ] **Step 5:** Commit `feat(host): one host for Chrome and Firefox`.

### Task 3: Extension partagée + construction Firefox

**Files:**
- Modify: `chrome-extension/lock.js`, `chrome-extension/background.js`
- Create: `scripts/build-firefox.mjs`, `scripts/sign-firefox.sh`
- Modify: `.gitignore` (`build/`, `web-ext-artifacts/`, `*.xpi`), `package.json` (test inclut `tests/firefox-manifest.test.mjs` via le glob existant)
- Test: `tests/lock.test.mjs`, `tests/firefox-manifest.test.mjs`

**Interfaces:**
- Consumes: GetLock `{active, endsAt, browser, lock, chrome}` (Task 4) ; ping de l'hôte (Task 2, ignoré).
- Produces:
  - `shellLockFor(browser, shellData) -> lock|null` : `shellData.browser === browser ? shellData.lock : null` ; sans `browser` (Shell V1) et `browser === 'chrome'` → `shellData.chrome ?? null`.
  - `decideRecovery(lock, tabs [{id, windowId, url, active}], windowIds number[]) -> {action:'keep'} | {action:'adopt', tabId, windowId} | {action:'adopt-window', windowId} | {action:'reopen', url} | {action:'none'}`
  - `firefoxManifest(chromeManifest) -> object` ; `GECKO_ID = 'deep-work-lock@deepwork.local'` ; CLI `node scripts/build-firefox.mjs [outDir=build/firefox]`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/lock.test.mjs
test('shellLockFor', () => {
    const l = {kind: 'tab'};
    assert.equal(shellLockFor('firefox', {active: true, browser: 'firefox', lock: l}), l);
    assert.equal(shellLockFor('chrome', {active: true, browser: 'firefox', lock: l}), null);
    assert.equal(shellLockFor('chrome', {active: true, chrome: l}), l);      // V1 shell
    assert.equal(shellLockFor('firefox', {active: true, chrome: l}), null);
    assert.equal(shellLockFor('chrome', null), null);
});
test('decideRecovery: tab still there', () => {
    const tabs = [{id: 5, windowId: 2, url: 'https://docs.google.com/d/9', active: true}];
    assert.deepEqual(decideRecovery(tabLock(), tabs, [2]), {action: 'keep'});
});
test('decideRecovery: adopts a restored tab, exact URL first', () => {
    const tabs = [{id: 1, windowId: 1, url: 'https://docs.google.com/other', active: true},
        {id: 3, windowId: 4, url: 'https://docs.google.com/d/1', active: false},
        {id: 5, windowId: 4, url: 'https://news.com', active: false}];
    assert.deepEqual(decideRecovery(tabLock(), tabs, [1, 4]), {action: 'adopt', tabId: 3, windowId: 4});
    assert.deepEqual(decideRecovery(tabLock(), tabs.slice(0, 1), [1]), {action: 'adopt', tabId: 1, windowId: 1});
});
test('decideRecovery: reopens when nothing matches', () => {
    assert.deepEqual(decideRecovery(tabLock(), [{id: 5, windowId: 2, url: 'https://news.com', active: true}], [2]),
        {action: 'reopen', url: 'https://docs.google.com/d/1'});
    assert.deepEqual(decideRecovery(tabLock({lastUrl: null, site: null}), [], []), {action: 'none'});
});
test('decideRecovery: window lock', () => {
    assert.deepEqual(decideRecovery(winLock(), [], [2, 3]), {action: 'keep'});
    assert.deepEqual(decideRecovery(winLock(), [], [7]), {action: 'adopt-window', windowId: 7});
    assert.deepEqual(decideRecovery(winLock(), [], []), {action: 'none'});
    assert.deepEqual(decideRecovery(null, [], []), {action: 'none'});
});

// tests/firefox-manifest.test.mjs
test('firefox manifest', () => {
    const chrome = JSON.parse(readFileSync('chrome-extension/manifest.json', 'utf8'));
    const ff = firefoxManifest(chrome);
    assert.equal(ff.manifest_version, 3);
    assert.equal(ff.version, chrome.version);
    assert.equal('key' in ff, false);
    assert.equal('minimum_chrome_version' in ff, false);
    assert.deepEqual(ff.background, {scripts: ['background.js'], type: 'module'});
    assert.deepEqual(ff.browser_specific_settings, {gecko: {id: 'deep-work-lock@deepwork.local',
        strict_min_version: '140.0', data_collection_permissions: {required: ['none']}}});
    assert.deepEqual(ff.permissions, chrome.permissions);
    assert.deepEqual(ff.host_permissions, chrome.host_permissions);
    assert.equal(chrome.key.length > 0, true); // chrome manifest untouched
});
```

- [ ] **Step 2:** `node --test tests/lock.test.mjs tests/firefox-manifest.test.mjs` → FAIL.
- [ ] **Step 3:** Implémenter `shellLockFor`, `decideRecovery` (onglet gardé si `id === lock.tabId` et (`url === lastUrl` ou `siteOf(url) === lock.site`) ; sinon candidat URL exacte, puis même site, actif d'abord ; sinon `reopen` si `lastUrl`), `firefoxManifest` + CLI de copie. Puis `background.js` :
  - `BROWSER` ; `onLockState` utilise `shellLockFor`. Si le verrou vient de GNOME et pas du stockage (`!lock && shellLock`), appeler `recover(shellLock)` : applique `decideRecovery` sur `tabs.query({})` / `windows.getAll({windowTypes:['normal']})`, sauvegarde le verrou avec les nouveaux ids, met le focus, puis `send({type:'expectWindow', reason:'relocated', bounds})` avec les coordonnées de la fenêtre. `reopen` : `windows.create({url, focused:true})` sous `ownTabCreations`.
  - `windows.onCreated` : `try { addListener(fn, {windowTypes:['normal','popup']}) } catch { addListener(fn) }` ; sans filtre, ignorer les types autres que `normal`/`popup` dans le handler.
  - `scripts/sign-firefox.sh` : exige `WEB_EXT_API_KEY` / `WEB_EXT_API_SECRET`, lance `node scripts/build-firefox.mjs`, puis `npx --yes web-ext@10.7.0 sign --channel unlisted --source-dir build/firefox --artifacts-dir web-ext-artifacts`, affiche le `.xpi` produit.
- [ ] **Step 4:** `npm test` → PASS ; `node scripts/build-firefox.mjs && npx --yes web-ext@10.7.0 lint --source-dir build/firefox` → 0 erreur.
- [ ] **Step 5:** Commit `feat(extension): Firefox build and restart recovery`.

### Task 4: Extension GNOME multi-navigateurs

**Files:**
- Modify: `lib/dbus.js`, `lib/windowGuard.js`, `lib/panel.js`, `extension.js` (sous `gnome-extension/deep-work-lock@deepwork.local/`)

**Interfaces:**
- Consumes: tout Task 1.
- Produces:
  - `ShellService({getLock, expectWindow})` exportant `GetLock`, `ExpectWindow(s detail)` → `expectWindow(parseExpect(detail))`, `ExpectChromeWindow(s detail)` → `expectWindow(parseExpect(detail, 'chrome'))` forcé à chrome.
  - `browserCall(browser, method, arg?) -> Promise` (remplace `chromeCall`).
  - `browserOfWindow(metaWindow) -> 'chrome'|'firefox'|null` dans `windowGuard.js` (remplace `isChromeWindow`).
  - `WindowGuard.expectWindow({browser, reason, bounds})` (remplace `expectChromeWindow`).
  - Cible d'UI : `{kind, metaWindow, appId, tabId?, browser?, browserWindowId?}` ; clés `win:<xid>`, `app:<appId>`, `tab:<browser>:<tabId>`.
  - État : `{version: 2, …, target: {kind, windowId, appId, tabId, browser, browserWindowId, label}, browserLock, saved}` ; GetLock `{active, endsAt, browser: target.browser, lock: browserLock, chrome: browser === 'chrome' ? browserLock : null}`.

- [ ] **Step 1:** `windowGuard.js` : `_info` donne `browser` ; liste `_pending` gardée `RECOVERY_WINDOW_MS`, candidats `{browser, time, rect: win.get_frame_rect()}` passés à `pickAnnounced` ; `_onWindowCreated` : chemin `_allowUntil` seulement si `_allowDetail.browser === browserOfWindow(win)`.
- [ ] **Step 2:** `dbus.js` + `extension.js` : `upgradeState(readState())` au démarrage ; `_lock` écrit l'état v2 ; requête de verrou envoyée par `browserCall(target.browser, 'Lock', …)` ; flash `${BROWSERS[b].name} injoignable : verrou limité à la fenêtre` ; `_endSession` appelle `browserCall(target.browser, 'Unlock')` si `browser`.
- [ ] **Step 3:** `panel.js` : pour chaque navigateur ayant des fenêtres candidates, `ListWindows` en parallèle (`Promise.allSettled`) ; rendu avec `matchBrowserWindows` par navigateur ; un message `Extension ${name} non connectée : onglets indisponibles` par navigateur en échec ; icône de repli `BROWSERS[b].icon`.
- [ ] **Step 4:** Vérifier que les modules se chargent : `npm test` → PASS, puis `gjs -m` d'un petit script qui importe `policy.js` n'est pas suffisant pour les modules Shell ; vérifier la syntaxe des fichiers modifiés avec `node --check` sur une copie `.mjs` (les imports `gi://` ne sont pas résolus par `--check`).
- [ ] **Step 5:** Commit `feat(gnome): lock Firefox tabs and windows`.

### Task 5: Installation, désinstallation, README

**Files:**
- Modify: `install.sh`, `uninstall.sh`, `README.md`

- [ ] **Step 1:** `install.sh` : construit `build/firefox` (`node scripts/build-firefox.mjs`) ; écrit `~/.mozilla/native-messaging-hosts/org.deepworklock.host.json` (`allowed_extensions: ["deep-work-lock@deepwork.local"]`, même `path` que Chrome) ; si `/snap/bin/firefox` existe, écrit l'autorisation du portail (`gdbus call … PermissionStore.SetPermission webextensions true org.deepworklock.host snap.firefox "['yes']"`) en l'annonçant, sans échouer si le portail est absent ; texte final : installer le `.xpi` signé (glisser dans Firefox ou `about:addons` → ⚙ → Installer depuis un fichier), ou en attendant `about:debugging#/runtime/this-firefox` → « Charger un module temporaire » → `build/firefox/manifest.json`. `DWL_NO_ENABLE` respecté.
- [ ] **Step 2:** `uninstall.sh` : retire le manifeste Firefox et l'autorisation du portail (`DeletePermission webextensions org.deepworklock.host snap.firefox`, erreurs ignorées) ; rappel `about:addons`.
- [ ] **Step 3:** README : Firefox dans l'intro et l'utilisation ; section « Firefox : signature » (compte Mozilla, addons.mozilla.org → Outils → Gérer les clés API, `WEB_EXT_API_KEY=… WEB_EXT_API_SECRET=… scripts/sign-firefox.sh`) ; limites (barre latérale, navigation privée) ; retirer « Firefox non pris en charge ».
- [ ] **Step 4:** `bash -n install.sh uninstall.sh scripts/sign-firefox.sh` → OK ; `DWL_DRY_RUN=1 ./uninstall.sh` → sortie 0.
- [ ] **Step 5:** Commit `feat: install the Firefox host and document signing`.

### Task 6: Vérification réelle dans Firefox

- [ ] **Step 1:** Installer le manifeste d'hôte Firefox pointant vers `native-host/deep_work_lock_host.py` du dépôt, lancer `npx --yes web-ext@10.7.0 run --source-dir build/firefox --firefox /snap/bin/firefox --firefox-profile ~/snap/firefox/common/dwl-test-profile --keep-profile-changes`.
- [ ] **Step 2:** `gdbus call --session --dest org.deepworklock.FirefoxBridge --object-path /org/deepworklock/FirefoxBridge --method org.deepworklock.FirefoxBridge.ListWindows` → JSON avec onglets ; `Lock` d'un onglet → verrou renvoyé (règle DNR acceptée) ; `Unlock` → `{"ok": true}`. Le nom `org.deepworklock.FirefoxBridge` toujours présent après 2 min sans activité.
- [ ] **Step 3:** Remettre à l'utilisateur la liste de vérifications manuelles (dans le README ou la réponse finale) : menu avec Chrome + Firefox, verrou d'onglet Firefox (nouvel onglet, Ctrl+Maj+A, `about:config`, navigation hors site, popup de connexion, onglet fermé, onglet glissé), Firefox Ctrl+Q, redémarrage de Firefox, mode de dépannage, redémarrage de GNOME Shell, session V1 reprise, Chrome inchangé.
