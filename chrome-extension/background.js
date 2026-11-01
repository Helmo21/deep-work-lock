// Service worker: applies the tab lock ordered by the GNOME extension through
// the native messaging host. Decisions live in lock.js.

import {
    siteOf, decideNewTab, decideNewWindow, decideNavigation,
    decideTabRemoved, decideTabAttached, dnrRules, restoreLock,
} from './lock.js';

const HOST = 'org.deepworklock.host';
const STORAGE_KEY = 'lock';

let lock = null;
let port = null;
let retryDelay = 1000;
let ownTabCreations = 0;
const allowedPopups = new Set();

// ---- state --------------------------------------------------------------

const ready = (async () => {
    const stored = (await chrome.storage.session.get(STORAGE_KEY))[STORAGE_KEY] ?? null;
    lock = restoreLock(stored, null, Date.now());
    if (!lock && stored)
        await clearLock();
})();

async function current() {
    await ready;
    if (lock && Date.now() >= lock.endsAt)
        await clearLock();
    return lock;
}

async function saveLock(next) {
    lock = next;
    await chrome.storage.session.set({[STORAGE_KEY]: lock});
    await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [1],
        addRules: dnrRules(lock),
    });
}

async function clearLock() {
    lock = null;
    allowedPopups.clear();
    await chrome.storage.session.remove(STORAGE_KEY);
    await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds: [1]});
}

const ignore = () => {};

// ---- native host --------------------------------------------------------

function connect() {
    try {
        port = chrome.runtime.connectNative(HOST);
    } catch (e) {
        scheduleReconnect();
        return;
    }
    port.onMessage.addListener(onHostMessage);
    port.onDisconnect.addListener(() => {
        void chrome.runtime.lastError;
        port = null;
        scheduleReconnect();
    });
    port.postMessage({type: 'hello'});
    port.postMessage({type: 'getLock'});
}

function scheduleReconnect() {
    setTimeout(connect, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30000);
}

function send(message) {
    try {
        port?.postMessage(message);
    } catch {
        // host gone; reconnect logic handles it
    }
}

async function onHostMessage(message) {
    retryDelay = 1000;
    if (message.type === 'lockState') {
        await ready;
        const shell = message.data;
        if (!shell || !shell.active) {
            if (lock)
                await clearLock();
            return;
        }
        const restored = restoreLock(lock, shell.chrome ?? null, Date.now());
        if (restored && restored !== lock)
            await saveLock(restored);
        return;
    }
    if (message.id === undefined)
        return;
    try {
        const data = await handleRequest(message.type, message.payload);
        send({replyTo: message.id, ok: true, data});
    } catch (e) {
        send({replyTo: message.id, ok: false, error: String(e?.message ?? e)});
    }
}

async function handleRequest(type, payload) {
    await ready;
    switch (type) {
    case 'listWindows': {
        const windows = await chrome.windows.getAll({populate: true, windowTypes: ['normal']});
        return {
            windows: windows.map(w => ({
                id: w.id,
                focused: w.focused,
                activeTitle: w.tabs.find(t => t.active)?.title ?? '',
                tabs: w.tabs.map(t => ({id: t.id, title: t.title, url: t.url, active: t.active})),
            })),
        };
    }
    case 'lock':
        return lockFromRequest(payload);
    case 'unlock':
        await clearLock();
        return {ok: true};
    default:
        throw new Error(`unknown request ${type}`);
    }
}

async function lockFromRequest({kind, tabId, windowId, endsAt}) {
    if (kind === 'tab') {
        const tab = await chrome.tabs.get(tabId);
        await chrome.tabs.update(tab.id, {active: true});
        await chrome.windows.update(tab.windowId, {focused: true});
        await saveLock({kind, tabId: tab.id, windowId: tab.windowId,
            site: siteOf(tab.url), lastUrl: tab.url, endsAt});
    } else {
        await chrome.windows.update(windowId, {focused: true});
        await saveLock({kind: 'window', tabId: null, windowId, site: null, lastUrl: null, endsAt});
    }
    return lock;
}

// ---- enforcement --------------------------------------------------------

async function revertTab(tabId) {
    if (lock.kind === 'tab' && lock.lastUrl) {
        await chrome.tabs.update(tabId, {url: lock.lastUrl}).catch(ignore);
        return;
    }
    await chrome.tabs.goBack(tabId).catch(() => chrome.tabs.remove(tabId).catch(ignore));
}

chrome.tabs.onCreated.addListener(async tab => {
    const l = await current();
    if (!l || ownTabCreations > 0)
        return;
    const win = await chrome.windows.get(tab.windowId).catch(() => null);
    if (!win || win.type === 'popup')
        return; // popups are judged in windows.onCreated
    if (decideNewTab(l, tab) === 'close')
        await chrome.tabs.remove(tab.id).catch(ignore);
});

chrome.windows.onCreated.addListener(async win => {
    const l = await current();
    if (!l || ownTabCreations > 0)
        return;
    // A popup's tab may not exist yet when the window event fires.
    await new Promise(r => setTimeout(r, 150));
    const tabs = await chrome.tabs.query({windowId: win.id});
    const lockedWindowTabs = l.kind === 'window'
        ? (await chrome.tabs.query({windowId: l.windowId})).map(t => t.id)
        : [];
    // window.open() does not always set openerTabId: then trust the popup,
    // since every other Chrome window is hidden by the desktop lock.
    const first = tabs[0]
        ? {...tabs[0], openerTabId: tabs[0].openerTabId ?? (l.kind === 'tab' ? l.tabId : lockedWindowTabs[0])}
        : null;
    if (decideNewWindow(l, win, first, lockedWindowTabs) === 'allow-popup') {
        allowedPopups.add(win.id);
        send({type: 'expectWindow', reason: 'popup'});
    } else {
        await chrome.windows.remove(win.id).catch(ignore);
    }
}, {windowTypes: ['normal', 'popup']});

chrome.windows.onRemoved.addListener(id => allowedPopups.delete(id));

chrome.tabs.onActivated.addListener(async ({tabId, windowId}) => {
    const l = await current();
    if (l?.kind === 'tab' && windowId === l.windowId && tabId !== l.tabId)
        await chrome.tabs.update(l.tabId, {active: true}).catch(ignore);
});

chrome.windows.onFocusChanged.addListener(async windowId => {
    const l = await current();
    if (!l || windowId === chrome.windows.WINDOW_ID_NONE)
        return;
    if (windowId !== l.windowId && !allowedPopups.has(windowId))
        await chrome.windows.update(l.windowId, {focused: true}).catch(ignore);
});

async function checkNavigation(tabId, url, windowId) {
    const l = await current();
    if (!l || !url)
        return;
    if (decideNavigation(l, tabId, url, windowId) === 'revert') {
        await revertTab(tabId);
    } else if (l.kind === 'tab' && tabId === l.tabId && siteOf(url) === l.site) {
        await saveLock({...l, lastUrl: url});
    }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url)
        checkNavigation(tabId, changeInfo.url, tab.windowId);
});

chrome.webNavigation.onBeforeNavigate.addListener(async details => {
    if (details.frameId !== 0)
        return;
    const l = await current();
    if (l && decideNavigation(l, details.tabId, details.url, l.windowId) === 'revert' &&
        l.kind === 'tab')
        await revertTab(details.tabId);
});

chrome.tabs.onRemoved.addListener(async (tabId, {isWindowClosing}) => {
    const l = await current();
    const decision = decideTabRemoved(l, tabId, isWindowClosing);
    if (decision.action !== 'reopen' || !decision.url)
        return;
    ownTabCreations++;
    try {
        let tab;
        if (decision.inWindow !== null) {
            tab = await chrome.tabs.create({windowId: decision.inWindow, url: decision.url, active: true});
        } else {
            send({type: 'expectWindow', reason: 'relocated'});
            const win = await chrome.windows.create({url: decision.url, focused: true});
            tab = win.tabs[0];
        }
        await saveLock({...l, tabId: tab.id, windowId: tab.windowId});
    } finally {
        ownTabCreations--;
    }
});

chrome.tabs.onAttached.addListener(async (tabId, {newWindowId}) => {
    const l = await current();
    if (decideTabAttached(l, tabId, newWindowId).action !== 'move-back')
        return;
    try {
        await chrome.tabs.move(tabId, {windowId: l.windowId, index: -1});
        await chrome.tabs.update(tabId, {active: true});
        await chrome.windows.update(l.windowId, {focused: true});
    } catch {
        // the original window is gone: follow the tab
        await saveLock({...l, windowId: newWindowId});
    }
});

connect();
