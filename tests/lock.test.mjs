import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
    siteOf, isInternalUrl, decideNewTab, decideNewWindow, decideNavigation,
    decidePopupNavigation, decideTabRemoved, decideTabAttached, dnrRules, restoreLock,
    IDENTITY_HOSTS, shellLockFor, decideRecovery,
} from '../chrome-extension/lock.js';

const tabLock = o => ({kind: 'tab', tabId: 5, windowId: 2, site: 'docs.google.com',
    lastUrl: 'https://docs.google.com/d/1', endsAt: 10_000, ...o});
const winLock = o => ({kind: 'window', tabId: null, windowId: 2, site: null,
    lastUrl: null, endsAt: 10_000, ...o});

test('siteOf', () => {
    assert.equal(siteOf('https://docs.google.com/x'), 'docs.google.com');
    assert.equal(siteOf('https://www.bbc.co.uk/news'), 'bbc.co.uk');
    assert.equal(siteOf('http://localhost:3000/a'), 'localhost');
    assert.equal(siteOf('https://127.0.0.1/'), '127.0.0.1');
    assert.equal(siteOf('chrome://settings'), null);
    assert.equal(siteOf('not a url'), null);
});

test('isInternalUrl', () => {
    assert.equal(isInternalUrl('chrome://extensions'), true);
    assert.equal(isInternalUrl('devtools://devtools/x'), true);
    assert.equal(isInternalUrl('chrome-extension://abc/x.html'), true);
    assert.equal(isInternalUrl('view-source:https://a.com'), true);
    assert.equal(isInternalUrl('https://a.com'), false);
    assert.equal(isInternalUrl('about:blank'), false);
});

test('decideNewTab', () => {
    assert.equal(decideNewTab(tabLock(), {id: 9, windowId: 2}), 'close');
    assert.equal(decideNewTab(tabLock(), {id: 9, windowId: 3}), 'close');
    assert.equal(decideNewTab(winLock(), {id: 9, windowId: 2}), 'close');
    assert.equal(decideNewTab(winLock(), {id: 9, windowId: 3}), 'allow');
    assert.equal(decideNewTab(null, {id: 9, windowId: 2}), 'allow');
});

test('decideNewWindow', () => {
    assert.equal(decideNewWindow(tabLock(), {id: 4, type: 'popup'}, {openerTabId: 5}, []), 'allow-popup');
    assert.equal(decideNewWindow(tabLock(), {id: 4, type: 'popup'}, {openerTabId: 8}, []), 'close');
    assert.equal(decideNewWindow(tabLock(), {id: 4, type: 'normal'}, {openerTabId: 5}, []), 'close');
    assert.equal(decideNewWindow(winLock(), {id: 4, type: 'popup'}, {openerTabId: 8}, [7, 8]), 'allow-popup');
    assert.equal(decideNewWindow(winLock(), {id: 4, type: 'normal'}, null, [7, 8]), 'close');
});

test('decideNavigation', () => {
    assert.equal(decideNavigation(tabLock(), 5, 'https://docs.google.com/d/2'), 'allow');
    assert.equal(decideNavigation(tabLock(), 5, 'https://accounts.google.com/x'), 'allow');
    assert.equal(decideNavigation(tabLock(), 5, 'https://mail.google.com/'), 'block');
    assert.equal(decideNavigation(tabLock(), 5, 'https://gemini.google.com/'), 'block');
    assert.equal(decideNavigation(tabLock(), 5, 'https://claude.ai'), 'block');
    assert.equal(decideNavigation(tabLock({site: 'example.com'}), 5, 'https://www.example.com/a'), 'allow');
    assert.equal(decideNavigation(tabLock({site: null}), 5, 'https://claude.ai'), 'allow');
    assert.equal(decideNavigation(tabLock(), 5, 'chrome://newtab'), 'revert');
    assert.equal(decideNavigation(tabLock(), 6, 'https://claude.ai'), 'allow');
    assert.equal(decideNavigation(tabLock(), 5, 'about:blank'), 'allow');
    // window lock: only internal pages are reverted, for tabs of that window
    assert.equal(decideNavigation(winLock(), 7, 'chrome://settings', 2), 'revert');
    assert.equal(decideNavigation(winLock(), 7, 'https://claude.ai', 2), 'allow');
    assert.equal(decideNavigation(winLock(), 7, 'chrome://settings', 3), 'allow');
});

test('decidePopupNavigation', () => {
    assert.equal(decidePopupNavigation(tabLock(), 'https://accounts.google.com/o/oauth2'), 'allow');
    assert.equal(decidePopupNavigation(tabLock(), 'about:blank'), 'allow');
    assert.equal(decidePopupNavigation(tabLock(), 'https://claude.ai'), 'close');
    assert.equal(decidePopupNavigation(tabLock(), 'chrome://settings'), 'close');
    assert.equal(decidePopupNavigation(winLock(), 'https://claude.ai'), 'allow');
});

test('decideTabRemoved', () => {
    assert.deepEqual(decideTabRemoved(tabLock(), 5, false),
        {action: 'reopen', url: 'https://docs.google.com/d/1', inWindow: 2});
    assert.deepEqual(decideTabRemoved(tabLock(), 5, true),
        {action: 'reopen', url: 'https://docs.google.com/d/1', inWindow: null});
    assert.deepEqual(decideTabRemoved(tabLock(), 6, false), {action: 'none'});
    assert.deepEqual(decideTabRemoved(winLock(), 5, false), {action: 'none'});
});

test('decideTabAttached', () => {
    assert.deepEqual(decideTabAttached(tabLock(), 5, 99), {action: 'move-back'});
    assert.deepEqual(decideTabAttached(tabLock(), 5, 2), {action: 'none'});
    assert.deepEqual(decideTabAttached(tabLock(), 6, 99), {action: 'none'});
});

test('dnrRules', () => {
    assert.deepEqual(dnrRules(tabLock({popupTabs: [8]})), [{
        id: 1, priority: 1, action: {type: 'block'},
        condition: {tabIds: [5, 8], resourceTypes: ['main_frame'],
            excludedRequestDomains: ['docs.google.com', ...IDENTITY_HOSTS]},
    }]);
    assert.deepEqual(dnrRules(winLock()), []);
    assert.deepEqual(dnrRules(tabLock({site: null})), []);
});

test('restoreLock prefers storage then shell', () => {
    const a = tabLock({tabId: 11});
    const b = tabLock({tabId: 22});
    assert.equal(restoreLock(a, b, 1000), a);
    assert.equal(restoreLock(null, b, 1000), b);
    assert.equal(restoreLock(a, b, 20_000), null);
    assert.equal(restoreLock(null, null, 1000), null);
});

test('shellLockFor', () => {
    const l = {kind: 'tab'};
    assert.equal(shellLockFor('firefox', {active: true, browser: 'firefox', lock: l}), l);
    assert.equal(shellLockFor('chrome', {active: true, browser: 'firefox', lock: l}), null);
    assert.equal(shellLockFor('chrome', {active: true, chrome: l}), l); // V1 shell
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

test('decideRecovery: same site prefers the active tab', () => {
    const tabs = [{id: 1, windowId: 1, url: 'https://docs.google.com/a', active: false},
        {id: 2, windowId: 1, url: 'https://docs.google.com/b', active: true}];
    assert.deepEqual(decideRecovery(tabLock(), tabs, [1]), {action: 'adopt', tabId: 2, windowId: 1});
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
