// Pure decision logic for the desktop lock. No GNOME imports here, so it can
// be unit-tested with Node.

export const DURATION_PRESETS = [25, 30, 45, 60, 90];
export const DEFAULT_DURATION = 30;
export const MAX_DURATION = 600;

export function parseDuration(input) {
    const text = String(input ?? '').trim();
    if (!/^\d+$/.test(text))
        return null;
    const minutes = Number(text);
    return minutes >= 1 && minutes <= MAX_DURATION ? minutes : null;
}

const pad = n => String(n).padStart(2, '0');

export function formatRemaining(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function lockMessage(ms) {
    return `🔒 Locked · ${formatRemaining(ms)} left`;
}

const DIALOG_TYPES = new Set(['dialog', 'modal_dialog', 'utility', 'splash']);

/**
 * Browsers whose tabs can be locked. The title separator and suffix pair an
 * X11 window with a browser window: "<active tab title><sep>...<suffix>".
 */
export const BROWSERS = {
    chrome: {
        id: 'chrome', name: 'Chrome', wmClass: /google-chrome/i,
        titleSeparator: ' - ', titleSuffix: 'Google Chrome',
        bridgeName: 'org.deepworklock.ChromeBridge', bridgePath: '/org/deepworklock/ChromeBridge',
        icon: 'google-chrome',
    },
    firefox: {
        id: 'firefox', name: 'Firefox', wmClass: /firefox/i,
        titleSeparator: ' \u2014 ', titleSuffix: 'Mozilla Firefox',
        bridgeName: 'org.deepworklock.FirefoxBridge', bridgePath: '/org/deepworklock/FirefoxBridge',
        icon: 'firefox',
    },
};

export function browserOfWmClass(wmClass, wmClassInstance) {
    const text = `${wmClass ?? ''} ${wmClassInstance ?? ''}`;
    return Object.values(BROWSERS).find(b => b.wmClass.test(text))?.id ?? null;
}

/**
 * Decide whether a window may stay visible and focused during a session.
 *
 * @param {object} win     {id, appId, type, overrideRedirect, transientChain, browser, createdAfterLock}
 * @param {object} target  {kind: 'window'|'app'|'tab', windowId, appId}
 * @param {object} ctx     {targetGone, announcedIds: Set}
 */
export function isWindowAllowed(win, target, ctx) {
    if (win.overrideRedirect)
        return true;
    if (win.type === 'desktop')
        return false;
    if (target.windowId && win.id === target.windowId)
        return true;
    if (target.windowId && win.transientChain.includes(target.windowId))
        return true;
    // Browser windows the browser extension vouched for (auth popups).
    if (ctx.announcedIds.has(win.id))
        return true;

    const sameApp = !!win.appId && win.appId === target.appId;

    switch (target.kind) {
    case 'app':
        return sameApp;
    case 'window':
        if (sameApp && DIALOG_TYPES.has(win.type))
            return true;
        // A new browser window only replaces the target when its extension
        // announced it: a browser restarted without the extension (safe
        // mode) must not get through.
        if (win.browser)
            return false;
        // Only a window opened after the lock may replace a closed target;
        // otherwise closing the target would reveal the app's other windows.
        return sameApp && ctx.targetGone && win.createdAfterLock;
    case 'tab':
        // New browser windows are only let through when the extension
        // vouches for them (auth popups, the reopened locked tab).
        if (win.browser && win.createdAfterLock)
            return false;
        return sameApp && DIALOG_TYPES.has(win.type);
    default:
        return false;
    }
}

/**
 * Pair X11 browser windows with browser window ids using the title, which
 * X11 shows as "<active tab title><separator><suffix>".
 *
 * @returns {Map<string, number>} X11 window id -> browser window id
 */
export function matchBrowserWindows(xwins, bwins, browser) {
    const {titleSeparator: sep, titleSuffix: suffix} = BROWSERS[browser];
    // Titles shared by several windows cannot be told apart: skip them
    // rather than risk locking the wrong window.
    const titleCount = new Map();
    for (const bw of bwins)
        titleCount.set(bw.activeTitle, (titleCount.get(bw.activeTitle) ?? 0) + 1);

    const result = new Map();
    for (const bw of bwins) {
        if (titleCount.get(bw.activeTitle) !== 1)
            continue;
        const prefix = `${bw.activeTitle}${sep}`;
        const candidates = xwins.filter(xw => xw.title.startsWith(prefix) && xw.title.includes(suffix));
        // A longer title can also start with this prefix ("A - B - Google Chrome").
        const exact = candidates.filter(xw => !bwins.some(other =>
            other !== bw && other.activeTitle.length > bw.activeTitle.length &&
            xw.title.startsWith(`${other.activeTitle}${sep}`)));
        if (exact.length === 1)
            result.set(exact[0].id, bw.id);
    }
    return result;
}

// An announcement only frees a window opened just before it, except a
// relocation with bounds: a restarting browser can take a while to bring its
// extension and native host up.
export const ANNOUNCE_WINDOW_MS = 3000;
export const RECOVERY_WINDOW_MS = 60000;
export const BOUNDS_TOLERANCE_PX = 60;

/** @param rect {x, y, width, height}  @param bounds {left, top, width, height}|null */
export function boundsMatch(rect, bounds) {
    if (!bounds)
        return true;
    return Math.abs(rect.x - bounds.left) <= BOUNDS_TOLERANCE_PX &&
        Math.abs(rect.y - bounds.top) <= BOUNDS_TOLERANCE_PX &&
        Math.abs(rect.width - bounds.width) <= BOUNDS_TOLERANCE_PX &&
        Math.abs(rect.height - bounds.height) <= BOUNDS_TOLERANCE_PX;
}

/**
 * Which hidden window an announcement vouches for.
 * @param candidates [{browser, time, rect, title}] oldest first
 * @param detail {browser, reason, bounds, title?} title = active tab title
 * @returns index of the newest matching candidate, or -1
 */
export function pickAnnounced(candidates, {browser, reason, bounds, title = null}, nowMs) {
    const late = reason === 'relocated' && !!bounds;
    const maxAge = late ? RECOVERY_WINDOW_MS : ANNOUNCE_WINDOW_MS;
    const sep = BROWSERS[browser]?.titleSeparator;
    const matches = [];
    candidates.forEach((c, i) => {
        if (c.browser === browser && nowMs - c.time < maxAge && boundsMatch(c.rect, bounds) &&
            (title === null || (c.title ?? '').startsWith(`${title}${sep}`)))
            matches.push(i);
    });
    // A restored session can bring back several windows of the same size:
    // freeing the wrong one would hand over a window outside the lock.
    if (matches.length > 1 && matches.some(i => nowMs - candidates[i].time >= ANNOUNCE_WINDOW_MS))
        return -1;
    return matches.length ? matches[matches.length - 1] : -1;
}

/** Window announcement from a native host: JSON {browser, reason, bounds} or a bare reason. */
export function parseExpect(detail, defaultBrowser = 'chrome') {
    let parsed = null;
    try {
        parsed = JSON.parse(detail);
    } catch {}
    if (!parsed || typeof parsed !== 'object')
        return {browser: defaultBrowser, reason: String(detail), bounds: null, title: null};
    return {
        browser: Object.hasOwn(BROWSERS, parsed.browser) ? parsed.browser : defaultBrowser,
        reason: parsed.reason ?? 'popup',
        bounds: parsed.bounds ?? null,
        title: typeof parsed.title === 'string' ? parsed.title : null,
    };
}

/** Session files written by version 1 only knew Chrome. */
export function upgradeState(state) {
    if (!state || state.version >= 2)
        return state;
    const {chrome = null, ...rest} = state;
    const {chromeWindowId = null, ...target} = state.target ?? {};
    const isChrome = (target.tabId ?? null) !== null || chromeWindowId !== null;
    return {
        ...rest,
        version: 2,
        target: {...target, browser: isChrome ? 'chrome' : null, browserWindowId: chromeWindowId},
        browserLock: chrome,
    };
}

/**
 * What to do with a session file found when the extension loads.
 * env = {bootId, shellInstance, wayland}. Same boot and not expired means
 * GNOME Shell restarted: resume. On Wayland a new Shell process is a new
 * login and window ids are meaningless, so only the same process resumes.
 */
export function decideStartup(state, env, nowMs) {
    if (!state)
        return 'none';
    if (state.bootId !== env.bootId || nowMs >= state.endsAt)
        return 'restore';
    if (env.wayland && state.shellInstance !== env.shellInstance)
        return 'restore';
    return 'resume';
}
