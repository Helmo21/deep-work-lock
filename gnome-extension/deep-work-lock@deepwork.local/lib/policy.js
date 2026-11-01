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
    return `🔒 Verrouillé · ${formatRemaining(ms)} restantes`;
}

const DIALOG_TYPES = new Set(['dialog', 'modal_dialog', 'utility', 'splash']);

/**
 * Decide whether a window may stay visible and focused during a session.
 *
 * @param {object} win     {id, appId, type, overrideRedirect, transientChain, isChrome, createdAfterLock}
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

    const sameApp = !!win.appId && win.appId === target.appId;

    switch (target.kind) {
    case 'app':
        return sameApp;
    case 'window':
        if (sameApp && DIALOG_TYPES.has(win.type))
            return true;
        return sameApp && ctx.targetGone;
    case 'tab':
        // New Chrome windows are only let through when the Chrome extension
        // vouches for them (auth popups, the reopened locked tab).
        if (win.isChrome && win.createdAfterLock)
            return ctx.announcedIds.has(win.id);
        return sameApp && DIALOG_TYPES.has(win.type);
    default:
        return false;
    }
}

/**
 * Pair X11 Chrome windows with Chrome window ids using the title, which X11
 * shows as "<active tab title> - Google Chrome".
 *
 * @returns {Map<string, number>} X11 window id -> Chrome window id
 */
export function matchChromeWindows(xwins, cwins) {
    const result = new Map();
    const claimed = new Set();
    const sorted = [...cwins].sort((a, b) => b.activeTitle.length - a.activeTitle.length);
    for (const cw of sorted) {
        const prefix = `${cw.activeTitle} - `;
        const candidates = xwins.filter(xw =>
            !claimed.has(xw.id) &&
            xw.title.startsWith(prefix) &&
            xw.title.includes('Google Chrome'));
        if (candidates.length === 0)
            continue;
        claimed.add(candidates[0].id);
        result.set(candidates[0].id, cw.id);
    }
    return result;
}

/**
 * What to do with a session file found when the extension loads.
 * Same boot and not expired means GNOME Shell restarted: resume.
 */
export function decideStartup(state, bootId, nowMs) {
    if (!state)
        return 'none';
    if (state.bootId === bootId && nowMs < state.endsAt)
        return 'resume';
    return 'restore';
}
