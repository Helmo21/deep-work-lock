import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
    DURATION_PRESETS, DEFAULT_DURATION, parseDuration, formatRemaining, lockMessage,
    isWindowAllowed, matchBrowserWindows, decideStartup, BROWSERS, browserOfWmClass,
    boundsMatch, pickAnnounced, parseExpect, upgradeState,
} from '../gnome-extension/deep-work-lock@helmo21.github.io/lib/policy.js';

const win = o => ({id: 'W', appId: 'x.desktop', type: 'normal', overrideRedirect: false,
    transientChain: [], browser: null, createdAfterLock: false, ...o});
const ctx = o => ({targetGone: false, announcedIds: new Set(), ...o});
const winTarget = {kind: 'window', windowId: 'T', appId: 'x.desktop'};
const appTarget = {kind: 'app', windowId: null, appId: 'x.desktop'};
const tabTarget = {kind: 'tab', windowId: 'T', appId: 'google-chrome.desktop'};

test('presets', () => {
    assert.deepEqual(DURATION_PRESETS, [25, 30, 45, 60, 90]);
    assert.equal(DEFAULT_DURATION, 30);
});

test('parseDuration', () => {
    assert.equal(parseDuration('45'), 45);
    assert.equal(parseDuration(' 12 '), 12);
    assert.equal(parseDuration(600), 600);
    assert.equal(parseDuration('0'), null);
    assert.equal(parseDuration('601'), null);
    assert.equal(parseDuration('abc'), null);
    assert.equal(parseDuration('2.5'), null);
    assert.equal(parseDuration(''), null);
});

test('formatRemaining', () => {
    assert.equal(formatRemaining(30 * 60000), '30:00');
    assert.equal(formatRemaining(61500), '01:02');
    assert.equal(formatRemaining(-5), '00:00');
    assert.equal(formatRemaining(90 * 60000), '1:30:00');
});

test('lockMessage', () => {
    assert.equal(lockMessage(754000), '🔒 Locked · 12:34 left');
});

test('override-redirect and the target itself are allowed', () => {
    assert.equal(isWindowAllowed(win({id: 'Z', overrideRedirect: true, appId: 'o'}), winTarget, ctx()), true);
    assert.equal(isWindowAllowed(win({id: 'T'}), winTarget, ctx()), true);
});

test('transient of target is allowed', () => {
    assert.equal(isWindowAllowed(win({id: 'D', appId: 'other', transientChain: ['P', 'T']}), winTarget, ctx()), true);
});

test('isWindowAllowed allows same-app dialog', () => {
    for (const type of ['dialog', 'modal_dialog', 'utility', 'splash'])
        assert.equal(isWindowAllowed(win({id: 'D', type}), winTarget, ctx()), true, type);
    assert.equal(isWindowAllowed(win({id: 'D', type: 'normal'}), winTarget, ctx()), false);
});

test('other app normal window rejected', () => {
    assert.equal(isWindowAllowed(win({id: 'S', appId: 'slack.desktop'}), winTarget, ctx()), false);
    assert.equal(isWindowAllowed(win({id: 'S', appId: null}), winTarget, ctx()), false);
});

test('app target allows any window of the app', () => {
    assert.equal(isWindowAllowed(win({id: 'A'}), appTarget, ctx()), true);
    assert.equal(isWindowAllowed(win({id: 'B', appId: 'y'}), appTarget, ctx()), false);
});

test('desktop window is never allowed', () => {
    assert.equal(isWindowAllowed(win({id: 'K', type: 'desktop'}), appTarget, ctx()), false);
});

test('window target gone: new same-app normal window allowed', () => {
    assert.equal(isWindowAllowed(win({id: 'N', createdAfterLock: true}), winTarget, ctx({targetGone: true})), true);
    assert.equal(isWindowAllowed(win({id: 'N', appId: 'y', createdAfterLock: true}), winTarget, ctx({targetGone: true})), false);
});

test('window target gone: older same-app windows stay locked', () => {
    assert.equal(isWindowAllowed(win({id: 'O', createdAfterLock: false}), winTarget, ctx({targetGone: true})), false);
});

test('isWindowAllowed rejects unannounced browser window', () => {
    for (const browser of ['chrome', 'firefox']) {
        const c = win({id: 'C', appId: `${browser}.desktop`, browser, createdAfterLock: true});
        const t = {...tabTarget, appId: `${browser}.desktop`};
        assert.equal(isWindowAllowed(c, t, ctx()), false, browser);
        assert.equal(isWindowAllowed(c, t, ctx({announcedIds: new Set(['C'])})), true, browser);
    }
    const c = win({id: 'C', appId: 'google-chrome.desktop', browser: 'chrome', createdAfterLock: true});
    assert.equal(isWindowAllowed(c, tabTarget, ctx()), false);
    assert.equal(isWindowAllowed(c, tabTarget, ctx({announcedIds: new Set(['C'])})), true);
    // an older chrome window (another existing window) is rejected too
    assert.equal(isWindowAllowed({...c, createdAfterLock: false}, tabTarget, ctx()), false);
});

test('announced chrome popup allowed for a chrome window target', () => {
    const t = {kind: 'window', windowId: 'T', appId: 'google-chrome.desktop'};
    const c = win({id: 'P', appId: 'google-chrome.desktop', browser: 'chrome', createdAfterLock: true});
    assert.equal(isWindowAllowed(c, t, ctx()), false);
    assert.equal(isWindowAllowed(c, t, ctx({announcedIds: new Set(['P'])})), true);
});

test('matchBrowserWindows: chrome titles', () => {
    const m = matchBrowserWindows(
        [{id: 'a', title: 'Article - Google Docs - Google Chrome'},
            {id: 'b', title: 'YouTube - Google Chrome'},
            {id: 'c', title: 'Terminal'}],
        [{id: 7, activeTitle: 'YouTube'}, {id: 9, activeTitle: 'Article - Google Docs'}], 'chrome');
    assert.deepEqual([...m].sort(), [['a', 9], ['b', 7]]);
});

test('matchBrowserWindows skips ambiguous titles', () => {
    const m = matchBrowserWindows(
        [{id: 'a', title: 'Docs - Google Chrome'}, {id: 'b', title: 'Docs - Google Chrome'}],
        [{id: 1, activeTitle: 'Docs'}, {id: 2, activeTitle: 'Docs'}], 'chrome');
    assert.equal(m.size, 0);
});

test('matchBrowserWindows: short chrome title is not confused with a longer one', () => {
    const m = matchBrowserWindows(
        [{id: 'a', title: 'A - B - Google Chrome'}, {id: 'b', title: 'A - Google Chrome'}],
        [{id: 1, activeTitle: 'A'}, {id: 2, activeTitle: 'A - B'}], 'chrome');
    assert.deepEqual([...m].sort(), [['a', 2], ['b', 1]]);
});

test('browser table', () => {
    assert.equal(BROWSERS.chrome.bridgeName, 'org.deepworklock.ChromeBridge');
    assert.equal(BROWSERS.chrome.bridgePath, '/org/deepworklock/ChromeBridge');
    assert.equal(BROWSERS.firefox.bridgeName, 'org.deepworklock.FirefoxBridge');
    assert.equal(BROWSERS.firefox.bridgePath, '/org/deepworklock/FirefoxBridge');
    assert.equal(BROWSERS.firefox.titleSeparator, ' — ');
    assert.equal(BROWSERS.firefox.name, 'Firefox');
});

test('browserOfWmClass', () => {
    assert.equal(browserOfWmClass('Google-chrome', 'google-chrome'), 'chrome');
    assert.equal(browserOfWmClass('firefox_firefox', 'Navigator'), 'firefox');
    assert.equal(browserOfWmClass('Gnome-terminal', 'gnome-terminal'), null);
    assert.equal(browserOfWmClass(null, null), null);
});

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

test('browser window target gone: only announced windows replace it', () => {
    const t = {kind: 'window', windowId: 'T', appId: 'firefox_firefox.desktop'};
    const f = win({id: 'N', appId: 'firefox_firefox.desktop', browser: 'firefox', createdAfterLock: true});
    assert.equal(isWindowAllowed(f, t, ctx({targetGone: true})), false);
    assert.equal(isWindowAllowed(f, t, ctx({targetGone: true, announcedIds: new Set(['N'])})), true);
    // a browser dialog stays usable
    assert.equal(isWindowAllowed({...f, type: 'dialog'}, t, ctx()), true);
    // non-browser apps keep the V1 rule
    assert.equal(isWindowAllowed(win({id: 'N', createdAfterLock: true}), winTarget, ctx({targetGone: true})), true);
});

test('boundsMatch', () => {
    const r = {x: 140, y: 109, width: 1332, height: 1092};
    assert.equal(boundsMatch(r, null), true);
    assert.equal(boundsMatch(r, {left: 180, top: 109, width: 1332, height: 1092}), true);
    assert.equal(boundsMatch(r, {left: 300, top: 109, width: 1332, height: 1092}), false);
});

test('pickAnnounced', () => {
    const r = {x: 140, y: 109, width: 1332, height: 1092};
    const b = {left: 140, top: 109, width: 1332, height: 1092};
    const c = [{browser: 'firefox', time: 0, rect: r}, {browser: 'firefox', time: 1000, rect: {x: 0, y: 0, width: 10, height: 10}}];
    assert.equal(pickAnnounced(c, {browser: 'firefox', bounds: null}, 2000), 1);
    assert.equal(pickAnnounced(c, {browser: 'firefox', bounds: b}, 2000), 0);
});

test('pickAnnounced accepts a late announcement with bounds', () => {
    const r = {x: 140, y: 109, width: 1332, height: 1092};
    const c = [{browser: 'firefox', time: 0, rect: r}];
    assert.equal(pickAnnounced(c, {browser: 'firefox', bounds: null}, 5000), -1);
    assert.equal(pickAnnounced(c, {browser: 'firefox', reason: 'relocated', bounds: {left: 150, top: 100, width: 1340, height: 1080}}, 30000), 0);
    assert.equal(pickAnnounced(c, {browser: 'firefox', reason: 'relocated', bounds: {left: 140, top: 109, width: 1332, height: 1092}}, 61000), -1);
});

test('pickAnnounced ignores other browsers', () => {
    const c = [{browser: 'chrome', time: 0, rect: {x: 0, y: 0, width: 5, height: 5}}];
    assert.equal(pickAnnounced(c, {browser: 'firefox', bounds: null}, 100), -1);
});

test('parseExpect', () => {
    assert.deepEqual(parseExpect('{"browser":"firefox","reason":"relocated","bounds":null}'),
        {browser: 'firefox', reason: 'relocated', bounds: null, title: null});
    assert.deepEqual(parseExpect('{"reason":"popup"}'), {browser: 'chrome', reason: 'popup', bounds: null, title: null});
    assert.deepEqual(parseExpect('popup'), {browser: 'chrome', reason: 'popup', bounds: null, title: null});
    assert.equal(parseExpect('{"browser":"opera"}').browser, 'chrome');
});

test('upgradeState converts a V1 file', () => {
    const v1 = {version: 1, bootId: 'B', endsAt: 9, target: {kind: 'tab', windowId: '0x1', appId: 'google-chrome.desktop',
        tabId: 5, chromeWindowId: 2, label: 'x'}, chrome: {kind: 'tab', tabId: 5}, saved: []};
    const v2 = upgradeState(v1);
    assert.equal(v2.version, 2);
    assert.equal(v2.target.browser, 'chrome');
    assert.equal(v2.target.browserWindowId, 2);
    assert.equal('chromeWindowId' in v2.target, false);
    assert.deepEqual(v2.browserLock, {kind: 'tab', tabId: 5});
    assert.equal('chrome' in v2, false);
    assert.deepEqual(v2.saved, []);
    const plain = upgradeState({version: 1, target: {kind: 'window', windowId: '0x2', appId: 'a', tabId: null, chromeWindowId: null}, chrome: null});
    assert.equal(plain.target.browser, null);
    assert.equal(upgradeState(null), null);
    assert.equal(upgradeState(v2), v2);
});

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
    // An unknown instance never allows a Wayland resume, even if both sides are unknown
    const unk = {bootId: 'B1', shellInstance: 'unknown', wayland: true};
    assert.equal(decideStartup({bootId: 'B1', endsAt: 1000, shellInstance: 'unknown'}, unk, 500), 'restore');
});

test('browserOfWmClass: firefox from Mozilla deb/tarball', () => {
    assert.equal(browserOfWmClass('firefox', 'Navigator'), 'firefox');
    assert.equal(browserOfWmClass('firefox_firefox', 'firefox_firefox'), 'firefox');
});

test('pickAnnounced refuses an ambiguous late announcement', () => {
    const r = {x: 0, y: 0, width: 1920, height: 1080};
    const c = [{browser: 'firefox', time: 0, rect: r, title: 'Docs — Mozilla Firefox'},
        {browser: 'firefox', time: 100, rect: r, title: 'News — Mozilla Firefox'}];
    const b = {left: 0, top: 0, width: 1920, height: 1080};
    assert.equal(pickAnnounced(c, {browser: 'firefox', reason: 'relocated', bounds: b}, 10000), -1);
    // the active tab title tells them apart
    assert.equal(pickAnnounced(c, {browser: 'firefox', reason: 'relocated', bounds: b, title: 'Docs'}, 10000), 0);
    assert.equal(pickAnnounced(c, {browser: 'firefox', reason: 'relocated', bounds: b, title: 'Mail'}, 10000), -1);
});

test('pickAnnounced: only a relocation may free an older window', () => {
    const r = {x: 0, y: 0, width: 800, height: 600};
    const c = [{browser: 'chrome', time: 0, rect: r, title: 'DevTools'}];
    const b = {left: 0, top: 0, width: 800, height: 600};
    assert.equal(pickAnnounced(c, {browser: 'chrome', reason: 'popup', bounds: b}, 10000), -1);
    assert.equal(pickAnnounced(c, {browser: 'chrome', reason: 'relocated', bounds: b}, 10000), 0);
});

test('pickAnnounced: fresh popups still pick the newest', () => {
    const r = {x: 0, y: 0, width: 500, height: 600};
    const c = [{browser: 'chrome', time: 0, rect: r, title: 'a'}, {browser: 'chrome', time: 500, rect: r, title: 'b'}];
    assert.equal(pickAnnounced(c, {browser: 'chrome', reason: 'popup', bounds: {left: 0, top: 0, width: 500, height: 600}}, 1000), 1);
});

test('parseExpect keeps the title', () => {
    assert.equal(parseExpect('{"browser":"firefox","reason":"relocated","bounds":null,"title":"Docs"}').title, 'Docs');
    assert.equal(parseExpect('popup').title, null);
});
