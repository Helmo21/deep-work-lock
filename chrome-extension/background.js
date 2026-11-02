// Service worker: applies the tab lock ordered by the GNOME extension through
// the native messaging host. Decisions live in lock.js.

import {
    siteOf, decideNewTab, decideNewWindow, decideNavigation, decidePopupNavigation,
    decideTabRemoved, decideTabAttached, dnrRules, restoreLock,
} from './lock.js';

const HOST = 'org.deepworklock.host';
const STORAGE_KEY = 'lock';

let lock = null;
let port = null;
let retryDelay = 1000;
let ownTabCreations = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
            site: siteOf(tab.url), lastUrl: tab.url, endsAt, popupTabs: [], popupWindows: []});
    } else {
        await chrome.windows.update(windowId, {focused: true});
        await saveLock({kind: 'window', tabId: null, windowId, site: null, lastUrl: null, endsAt,
            popupTabs: [], popupWindows: []});
    }
    return lock;
}

// ---- enforcement --------------------------------------------------------

async function revertTab(tabId) {
    if (!lock)
        return;
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
    if (l.popupWindows?.includes(tab.windowId))
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
    await sleep(150);
    const tabs = await chrome.tabs.query({windowId: win.id});
    // The locked tab dragged out of its window: onAttached moves it back.
    if (tabs.some(t => t.id === l.tabId))
        return;
    const lockedWindowTabs = l.kind === 'window'
        ? (await chrome.tabs.query({windowId: l.windowId})).map(t => t.id)
        : [];
    // window.open() does not always set openerTabId: then trust the popup.
    // It stays confined to the locked site by the DNR rule and onUpdated.
    const first = tabs[0]
        ? {...tabs[0], openerTabId: tabs[0].openerTabId ?? (l.kind === 'tab' ? l.tabId : lockedWindowTabs[0])}
        : null;
    if (decideNewWindow(l, win, first, lockedWindowTabs) !== 'allow-popup') {
        await chrome.windows.remove(win.id).catch(ignore);
        return;
    }
    const fresh = await current();
    if (!fresh)
        return;
    await saveLock({...fresh,
        popupWindows: [...(fresh.popupWindows ?? []), win.id],
        popupTabs: [...(fresh.popupTabs ?? []), ...tabs.map(t => t.id)]});
    const bounds = await chrome.windows.get(win.id)
        .then(w => ({left: w.left, top: w.top, width: w.width, height: w.height}))
        .catch(() => null);
    send({type: 'expectWindow', reason: 'popup', bounds});
    if (first?.url)
        await checkPopupNavigation(first.id, first.url, win.id);
}, {windowTypes: ['normal', 'popup']});

chrome.windows.onRemoved.addListener(async id => {
    const l = await current();
    if (l?.popupWindows?.includes(id))
        await saveLock({...l, popupWindows: l.popupWindows.filter(w => w !== id)});
});

chrome.tabs.onActivated.addListener(async ({tabId, windowId}) => {
    const l = await current();
    if (l?.kind === 'tab' && windowId === l.windowId && tabId !== l.tabId)
        await chrome.tabs.update(l.tabId, {active: true}).catch(ignore);
});

// No refocusing on windows.onFocusChanged: GNOME already enforces focus, and
// two enforcers disagreeing about the window would loop.

async function checkPopupNavigation(tabId, url, windowId) {
    const l = await current();
    if (l?.popupWindows?.includes(windowId) && decidePopupNavigation(l, url) === 'close')
        await chrome.windows.remove(windowId).catch(ignore);
}

async function checkNavigation(tabId, url, windowId) {
    const l = await current();
    if (!l || !url)
        return;
    if (l.popupWindows?.includes(windowId)) {
        await checkPopupNavigation(tabId, url, windowId);
        return;
    }
    const decision = decideNavigation(l, tabId, url, windowId);
    if (decision === 'revert') {
        await revertTab(tabId);
    } else if (decision === 'allow' && l.kind === 'tab' && tabId === l.tabId && siteOf(url)) {
        // A lock started on a non-web page adopts the first site visited.
        await saveLock({...l, site: l.site ?? siteOf(url), lastUrl: url});
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
    if (l?.kind === 'tab' && decideNavigation(l, details.tabId, details.url) === 'revert')
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
            send({type: 'expectWindow', reason: 'relocated', bounds: null});
            const win = await chrome.windows.create({url: decision.url, focused: true});
            tab = win.tabs[0];
        }
        const fresh = await current();
        if (fresh)
            await saveLock({...fresh, tabId: tab.id, windowId: tab.windowId});
    } finally {
        ownTabCreations--;
    }
});

chrome.tabs.onAttached.addListener(async (tabId, {newWindowId}) => {
    const l = await current();
    if (decideTabAttached(l, tabId, newWindowId).action !== 'move-back')
        return;
    const originalExists = await chrome.windows.get(l.windowId).then(() => true, () => false);
    if (!originalExists) {
        await saveLock({...l, windowId: newWindowId});
        return;
    }
    // Moving fails while the user is still dragging: retry for a few seconds.
    for (let attempt = 0; attempt < 15; attempt++) {
        try {
            await chrome.tabs.move(tabId, {windowId: l.windowId, index: -1});
            await chrome.tabs.update(tabId, {active: true});
            await chrome.windows.update(l.windowId, {focused: true});
            return;
        } catch {
            await sleep(300);
        }
    }
});

// The worker only starts on a listened event: these wake it when Chrome
// starts or the extension is (re)enabled, so the host connects right away.
chrome.runtime.onStartup.addListener(ignore);
chrome.runtime.onInstalled.addListener(ignore);

connect();
