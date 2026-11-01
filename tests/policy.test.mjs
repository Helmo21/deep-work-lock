import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
    DURATION_PRESETS, DEFAULT_DURATION, parseDuration, formatRemaining, lockMessage,
    isWindowAllowed, matchChromeWindows, decideStartup,
} from '../gnome-extension/deep-work-lock@deepwork.local/lib/policy.js';

const win = o => ({id: 'W', appId: 'x.desktop', type: 'normal', overrideRedirect: false,
    transientChain: [], isChrome: false, createdAfterLock: false, ...o});
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
    assert.equal(lockMessage(754000), '🔒 Verrouillé · 12:34 restantes');
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
    assert.equal(isWindowAllowed(win({id: 'N'}), winTarget, ctx({targetGone: true})), true);
    assert.equal(isWindowAllowed(win({id: 'N', appId: 'y'}), winTarget, ctx({targetGone: true})), false);
});

test('isWindowAllowed rejects unannounced chrome window', () => {
    const c = win({id: 'C', appId: 'google-chrome.desktop', isChrome: true, createdAfterLock: true});
    assert.equal(isWindowAllowed(c, tabTarget, ctx()), false);
    assert.equal(isWindowAllowed(c, tabTarget, ctx({announcedIds: new Set(['C'])})), true);
    // an older chrome window (another existing window) is rejected too
    assert.equal(isWindowAllowed({...c, createdAfterLock: false}, tabTarget, ctx()), false);
});

test('announced chrome popup allowed for a chrome window target', () => {
    const t = {kind: 'window', windowId: 'T', appId: 'google-chrome.desktop'};
    const c = win({id: 'P', appId: 'google-chrome.desktop', isChrome: true, createdAfterLock: true});
    assert.equal(isWindowAllowed(c, t, ctx()), false);
    assert.equal(isWindowAllowed(c, t, ctx({announcedIds: new Set(['P'])})), true);
});

test('matchChromeWindows', () => {
    const m = matchChromeWindows(
        [{id: 'a', title: 'Article - Google Docs - Google Chrome'},
            {id: 'b', title: 'YouTube - Google Chrome'},
            {id: 'c', title: 'Terminal'}],
        [{id: 7, activeTitle: 'YouTube'}, {id: 9, activeTitle: 'Article - Google Docs'}]);
    assert.deepEqual([...m].sort(), [['a', 9], ['b', 7]]);
});

test('matchChromeWindows does not reuse an X11 window', () => {
    const m = matchChromeWindows(
        [{id: 'a', title: 'Docs - Google Chrome'}],
        [{id: 1, activeTitle: 'Docs'}, {id: 2, activeTitle: 'Docs'}]);
    assert.equal(m.size, 1);
});

test('decideStartup', () => {
    assert.equal(decideStartup(null, 'B1', 0), 'none');
    assert.equal(decideStartup({bootId: 'B1', endsAt: 1000}, 'B1', 500), 'resume');
    assert.equal(decideStartup({bootId: 'B1', endsAt: 1000}, 'B1', 1500), 'restore');
    assert.equal(decideStartup({bootId: 'B0', endsAt: 1000}, 'B1', 500), 'restore');
});
