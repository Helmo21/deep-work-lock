// Pure decisions for the Chrome side of the lock. No chrome.* calls here.
//
// Lock = {kind: 'tab'|'window', tabId, windowId, site, lastUrl, endsAt}

const MULTI_PART_SUFFIXES = new Set([
    'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'co.jp', 'com.br',
    'co.nz', 'gouv.fr', 'co.in', 'com.mx',
]);

const WEB_SCHEMES = new Set(['http:', 'https:']);
const HARMLESS_URLS = /^(about:blank|about:srcdoc|data:|blob:)/;

/** Registrable domain ("same site") of an http(s) URL, or null. */
export function siteOf(url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    if (!WEB_SCHEMES.has(parsed.protocol))
        return null;
    const host = parsed.hostname.replace(/\.$/, '');
    if (/^[\d.]+$/.test(host) || host.includes(':') || !host.includes('.'))
        return host;
    const labels = host.split('.');
    const lastTwo = labels.slice(-2).join('.');
    const keep = MULTI_PART_SUFFIXES.has(lastTwo) ? 3 : 2;
    return labels.slice(-keep).join('.');
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

export function decideNavigation(lock, tabId, url, windowId = null) {
    if (!lock)
        return 'allow';
    if (lock.kind === 'tab') {
        if (tabId !== lock.tabId)
            return 'allow';
        if (isInternalUrl(url))
            return 'revert';
        const site = siteOf(url);
        if (site === null || !lock.site)
            return 'allow';
        return site === lock.site ? 'allow' : 'revert';
    }
    if (windowId !== lock.windowId)
        return 'allow';
    return isInternalUrl(url) ? 'revert' : 'allow';
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
            tabIds: [lock.tabId],
            resourceTypes: ['main_frame'],
            excludedRequestDomains: [lock.site],
        },
    }];
}

export function restoreLock(fromStorage, fromShell, nowMs) {
    const lock = fromStorage ?? fromShell ?? null;
    if (!lock || nowMs >= lock.endsAt)
        return null;
    return lock;
}
