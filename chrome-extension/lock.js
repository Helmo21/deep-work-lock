// Pure decisions for the Chrome side of the lock. No chrome.* calls here.
//
// Lock = {kind: 'tab'|'window', tabId, windowId, site, lastUrl, endsAt,
//         popupTabs: number[], popupWindows: number[]}
//
// "site" is the host of the locked tab (spec: "l'origine de l'onglet"), with
// a leading "www." dropped. Its subdomains are allowed, siblings are not:
// a lock on docs.google.com does not open mail.google.com.

// Sign-in pages a locked site may need to bounce through.
export const IDENTITY_HOSTS = [
    'accounts.google.com',
    'login.microsoftonline.com',
    'login.live.com',
    'login.microsoft.com',
    'appleid.apple.com',
];

const WEB_SCHEMES = new Set(['http:', 'https:']);
const HARMLESS_URLS = /^(about:blank|about:srcdoc|data:|blob:)/;

/** Locked host of an http(s) URL, or null. */
export function siteOf(url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    if (!WEB_SCHEMES.has(parsed.protocol))
        return null;
    return parsed.hostname.replace(/\.$/, '').replace(/^www\./, '').toLowerCase();
}

export function isInternalUrl(url) {
    if (!url || HARMLESS_URLS.test(url))
        return false;
    try {
        return !WEB_SCHEMES.has(new URL(url).protocol);
    } catch {
        return false;
    }
}

const withinHost = (host, base) => host === base || host.endsWith(`.${base}`);

export function hostAllowed(lockSite, url) {
    const host = siteOf(url);
    if (host === null || !lockSite)
        return true;
    return withinHost(host, lockSite) || IDENTITY_HOSTS.some(h => withinHost(host, h));
}

export function decideNewTab(lock, tab) {
    if (!lock)
        return 'allow';
    if (lock.kind === 'tab')
        return 'close';
    return tab.windowId === lock.windowId ? 'close' : 'allow';
}

/**
 * @param lockedTabIdsInWindow ids of the tabs of the locked window (window lock)
 */
export function decideNewWindow(lock, win, firstTab, lockedTabIdsInWindow) {
    if (!lock)
        return 'allow-popup';
    if (win.type !== 'popup' || !firstTab)
        return 'close';
    const opener = firstTab.openerTabId;
    if (lock.kind === 'tab')
        return opener === lock.tabId ? 'allow-popup' : 'close';
    return lockedTabIdsInWindow.includes(opener) ? 'allow-popup' : 'close';
}

/**
 * 'revert' goes back to the last allowed page; 'block' leaves it to the
 * declarativeNetRequest rule (no revert, so redirect chains cannot loop).
 */
export function decideNavigation(lock, tabId, url, windowId = null) {
    if (!lock)
        return 'allow';
    if (lock.kind === 'tab') {
        if (tabId !== lock.tabId)
            return 'allow';
        if (isInternalUrl(url))
            return 'revert';
        return hostAllowed(lock.site, url) ? 'allow' : 'block';
    }
    if (windowId !== lock.windowId)
        return 'allow';
    return isInternalUrl(url) ? 'revert' : 'allow';
}

/** A popup opened by the locked tab must stay on the locked site. */
export function decidePopupNavigation(lock, url) {
    if (!lock || lock.kind !== 'tab')
        return isInternalUrl(url) ? 'close' : 'allow';
    if (isInternalUrl(url))
        return 'close';
    return hostAllowed(lock.site, url) ? 'allow' : 'close';
}

export function decideTabRemoved(lock, tabId, windowClosing) {
    if (!lock || lock.kind !== 'tab' || tabId !== lock.tabId)
        return {action: 'none'};
    return {action: 'reopen', url: lock.lastUrl, inWindow: windowClosing ? null : lock.windowId};
}

export function decideTabAttached(lock, tabId, newWindowId) {
    if (!lock || lock.kind !== 'tab' || tabId !== lock.tabId || newWindowId === lock.windowId)
        return {action: 'none'};
    return {action: 'move-back'};
}

export function dnrRules(lock) {
    if (!lock || lock.kind !== 'tab' || !lock.site)
        return [];
    return [{
        id: 1,
        priority: 1,
        action: {type: 'block'},
        condition: {
            tabIds: [lock.tabId, ...(lock.popupTabs ?? [])],
            resourceTypes: ['main_frame'],
            excludedRequestDomains: [lock.site, ...IDENTITY_HOSTS],
        },
    }];
}

export function restoreLock(fromStorage, fromShell, nowMs) {
    const lock = fromStorage ?? fromShell ?? null;
    if (!lock || nowMs >= lock.endsAt)
        return null;
    return lock;
}

/**
 * The lock GNOME holds for this browser. A version 1 Shell only knew Chrome
 * and sent it as `chrome`.
 */
export function shellLockFor(browser, shellData) {
    if (!shellData)
        return null;
    if (shellData.browser === undefined)
        return browser === 'chrome' ? shellData.chrome ?? null : null;
    return shellData.browser === browser ? shellData.lock ?? null : null;
}

/**
 * The browser restarted (or the extension reloaded): tab and window ids from
 * the lock may be stale. Find the locked tab again, or reopen it.
 *
 * @param tabs [{id, windowId, url, active}]  @param windowIds ids of normal windows
 */
export function decideRecovery(lock, tabs, windowIds) {
    if (!lock)
        return {action: 'none'};
    if (lock.kind === 'window') {
        if (windowIds.includes(lock.windowId))
            return {action: 'keep', windowId: lock.windowId};
        return windowIds.length ? {action: 'adopt-window', windowId: windowIds[0]} : {action: 'none'};
    }
    const sameSite = t => !!lock.site && siteOf(t.url) === lock.site;
    const same = tabs.find(t => t.id === lock.tabId);
    if (same && ((lock.lastUrl && same.url === lock.lastUrl) || sameSite(same)))
        return {action: 'keep', windowId: same.windowId};
    const activeFirst = [...tabs].sort((a, b) => Number(b.active) - Number(a.active));
    const found = activeFirst.find(t => lock.lastUrl && t.url === lock.lastUrl) ?? activeFirst.find(sameSite);
    if (found)
        return {action: 'adopt', tabId: found.id, windowId: found.windowId};
    return lock.lastUrl ? {action: 'reopen', url: lock.lastUrl} : {action: 'none'};
}
