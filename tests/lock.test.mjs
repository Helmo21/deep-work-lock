import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
    siteOf, isInternalUrl, decideNewTab, decideNewWindow, decideNavigation,
    decideTabRemoved, decideTabAttached, dnrRules, restoreLock,
} from '../chrome-extension/lock.js';

const tabLock = o => ({kind: 'tab', tabId: 5, windowId: 2, site: 'google.com',
    lastUrl: 'https://docs.google.com/d/1', endsAt: 10_000, ...o});
const winLock = o => ({kind: 'window', tabId: null, windowId: 2, site: null,
    lastUrl: null, endsAt: 10_000, ...o});

test('siteOf', () => {
    assert.equal(siteOf('https://docs.google.com/x'), 'google.com');
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
    assert.equal(decideNavigation(tabLock(), 5, 'https://accounts.google.com/x'), 'allow');
    assert.equal(decideNavigation(tabLock(), 5, 'https://claude.ai'), 'revert');
    assert.equal(decideNavigation(tabLock(), 5, 'chrome://newtab'), 'revert');
    assert.equal(decideNavigation(tabLock(), 6, 'https://claude.ai'), 'allow');
    assert.equal(decideNavigation(tabLock(), 5, 'about:blank'), 'allow');
    // window lock: only internal pages are reverted, for tabs of that window
    assert.equal(decideNavigation(winLock(), 7, 'chrome://settings', 2), 'revert');
    assert.equal(decideNavigation(winLock(), 7, 'https://claude.ai', 2), 'allow');
    assert.equal(decideNavigation(winLock(), 7, 'chrome://settings', 3), 'allow');
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
    assert.deepEqual(dnrRules(tabLock()), [{
        id: 1, priority: 1, action: {type: 'block'},
        condition: {tabIds: [5], resourceTypes: ['main_frame'], excludedRequestDomains: ['google.com']},
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
