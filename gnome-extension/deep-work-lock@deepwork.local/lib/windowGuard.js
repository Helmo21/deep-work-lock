// Keeps the target in front during a session: refocuses it, hides any other
// window, and lets through only the windows the policy allows.

import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {
    isWindowAllowed, browserOfWmClass, boundsMatch, pickAnnounced,
    ANNOUNCE_WINDOW_MS, RECOVERY_WINDOW_MS,
} from './policy.js';

/**
 * Bring a window up, switching to its workspace if needed. A plain
 * activate() on another workspace only marks the window as urgent.
 */
function focusWindow(win) {
    Main.activateWindow(win, global.display.get_current_time_roundtrip());
}

function frameRect(win) {
    const r = win.get_frame_rect();
    return {x: r.x, y: r.y, width: r.width, height: r.height};
}

const TYPE_NAMES = new Map([
    [Meta.WindowType.NORMAL, 'normal'],
    [Meta.WindowType.DIALOG, 'dialog'],
    [Meta.WindowType.MODAL_DIALOG, 'modal_dialog'],
    [Meta.WindowType.UTILITY, 'utility'],
    [Meta.WindowType.SPLASHSCREEN, 'splash'],
    [Meta.WindowType.DESKTOP, 'desktop'],
    [Meta.WindowType.DOCK, 'dock'],
    // Managed menus and tooltips behave like dialogs of their app.
    [Meta.WindowType.MENU, 'utility'],
    [Meta.WindowType.POPUP_MENU, 'utility'],
    [Meta.WindowType.DROPDOWN_MENU, 'utility'],
    [Meta.WindowType.TOOLTIP, 'utility'],
    [Meta.WindowType.COMBO, 'utility'],
    [Meta.WindowType.DND, 'utility'],
    [Meta.WindowType.NOTIFICATION, 'utility'],
]);

/** Stable id: the X11 window id, which survives a GNOME Shell restart. */
export function windowId(win) {
    const match = (win.get_description() ?? '').match(/0x[0-9a-f]+/i);
    return match ? match[0].toLowerCase() : `seq-${win.get_stable_sequence()}`;
}

/** App id; windows without a .desktop file are grouped by process. */
export function appIdOf(win) {
    const app = Shell.WindowTracker.get_default().get_window_app(win);
    if (!app || app.is_window_backed())
        return `pid:${win.get_pid()}`;
    return app.get_id();
}

/** 'chrome', 'firefox' or null. */
export function browserOfWindow(win) {
    return browserOfWmClass(win.get_wm_class(), win.get_wm_class_instance());
}

export function listWindows() {
    return global.get_window_actors()
        .map(actor => actor.meta_window)
        .filter(win => win && !win.is_override_redirect());
}

export function findWindowById(id) {
    return listWindows().find(win => windowId(win) === id) ?? null;
}

export class WindowGuard {
    constructor({onBlocked}) {
        this._onBlocked = onBlocked;
        this._active = false;
    }

    get target() {
        return this._target;
    }

    /** @param target {kind, windowId, appId} as in policy.js */
    start(target) {
        this._target = {...target};
        this._active = true;
        this._suspended = false;
        this._announced = new Set();
        this._pending = [];
        this._allowUntil = 0;
        this._allowDetail = null;
        this._queue = [];
        this._minimized = new Map(); // Meta.Window -> unmanaged handler id
        this._signals = [];
        this._targetSignals = [];
        this._knownBefore = new Set(listWindows().map(windowId));
        this._targetGone = false;

        this._connect(global.display, 'notify::focus-window', () => this._onFocusChanged());
        this._connect(global.display, 'window-created', (_d, win) => this._onWindowCreated(win));
        this._connect(global.workspace_manager, 'active-workspace-changed',
            () => this._later(() => this.activateTarget()));

        this._bindTargetWindow(this._target.windowId ? findWindowById(this._target.windowId) : null);

        // Windows the user had already minimized are left alone (and are not
        // unminimized at the end).
        for (const win of listWindows()) {
            if (!win.minimized && !this._isAllowed(win))
                this._hide(win);
        }
        this.activateTarget();
    }

    stop() {
        if (!this._active)
            return;
        this._active = false;
        for (const [obj, id] of [...this._signals, ...this._targetSignals])
            obj.disconnect(id);
        this._signals = [];
        this._targetSignals = [];
        if (this._idleId) {
            GLib.source_remove(this._idleId);
            this._idleId = 0;
        }
        this._queue = [];
        for (const p of this._pending)
            p.win.disconnect(p.handler);
        this._pending = [];
        if (this._nullFocusId) {
            GLib.source_remove(this._nullFocusId);
            this._nullFocusId = 0;
        }
        // Give back the windows we hid.
        for (const [win, id] of this._minimized) {
            win.disconnect(id);
            win.unminimize();
        }
        this._minimized.clear();
    }

    /** Pause enforcement while the screen is locked. */
    setSuspended(suspended) {
        this._suspended = suspended;
        if (!suspended && this._active)
            this._later(() => this.activateTarget());
    }

    /**
     * A browser extension vouches for a window of its browser.
     * @param detail {browser, reason: 'popup'|'relocated', bounds: {left, top, width, height}|null}
     */
    expectWindow({browser, reason, bounds}) {
        if (!this._active)
            return;
        this._prunePending();
        const candidates = this._pending.map(p => ({browser: p.browser, time: p.time, rect: frameRect(p.win)}));
        const index = pickAnnounced(candidates, {browser, bounds}, Date.now());
        if (index >= 0) {
            const match = this._pending[index];
            this._dropPending(match);
            this._announce(match.win, reason);
        } else {
            this._allowUntil = Date.now() + ANNOUNCE_WINDOW_MS;
            this._allowDetail = {browser, reason, bounds};
        }
    }

    _prunePending() {
        const now = Date.now();
        for (const p of [...this._pending]) {
            if (now - p.time >= RECOVERY_WINDOW_MS)
                this._dropPending(p);
        }
    }

    _dropPending(entry) {
        entry.win.disconnect(entry.handler);
        this._pending = this._pending.filter(p => p !== entry);
    }

    _addPending(win, browser) {
        const entry = {win, browser, time: Date.now(), handler: 0};
        entry.handler = win.connect('unmanaged', () => {
            this._pending = this._pending.filter(p => p !== entry);
        });
        this._pending.push(entry);
    }

    /** Windows the user may work in, best candidate first. */
    allowedWindows() {
        return listWindows()
            .filter(win => this._isAllowed(win) && TYPE_NAMES.get(win.get_window_type()) !== 'desktop')
            .sort((a, b) => b.get_user_time() - a.get_user_time());
    }

    activateTarget() {
        if (!this._active || this._suspended)
            return;
        const main = this._target.windowId ? findWindowById(this._target.windowId) : null;
        const win = main ?? this.allowedWindows()[0];
        if (win)
            focusWindow(win);
    }

    // ---- internals ------------------------------------------------------

    _connect(obj, signal, handler) {
        this._signals.push([obj, obj.connect(signal, handler)]);
    }

    _later(fn) {
        this._queue.push(fn);
        if (this._idleId)
            return;
        this._idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._idleId = 0;
            const queue = this._queue;
            this._queue = [];
            for (const f of queue) {
                if (this._active && !this._suspended)
                    f();
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    _info(win) {
        const chain = [];
        for (let p = win.get_transient_for(); p && chain.length < 10; p = p.get_transient_for())
            chain.push(windowId(p));
        const id = windowId(win);
        return {
            id,
            appId: appIdOf(win),
            type: TYPE_NAMES.get(win.get_window_type()) ?? 'other',
            overrideRedirect: win.is_override_redirect(),
            transientChain: chain,
            browser: browserOfWindow(win),
            createdAfterLock: !this._knownBefore.has(id),
        };
    }

    _isAllowed(win) {
        return isWindowAllowed(this._info(win), this._target,
            {targetGone: this._targetGone, announcedIds: this._announced});
    }

    _hide(win) {
        if (TYPE_NAMES.get(win.get_window_type()) === 'desktop' || !win.can_minimize())
            return;
        win.minimize();
        if (!this._minimized.has(win)) {
            const id = win.connect('unmanaged', () => this._minimized.delete(win));
            this._minimized.set(win, id);
        }
    }

    _bindTargetWindow(win) {
        for (const [obj, id] of this._targetSignals)
            obj.disconnect(id);
        this._targetSignals = [];
        if (!win) {
            this._targetGone = this._target.kind !== 'app';
            return;
        }
        this._targetGone = false;
        this._target.windowId = windowId(win);
        this._targetSignals.push([win, win.connect('unmanaged', () => {
            this._targetSignals = [];
            this._targetGone = true;
            this._later(() => this.activateTarget());
        })]);
        this._targetSignals.push([win, win.connect('notify::minimized', () => {
            if (win.minimized)
                this._later(() => this.activateTarget());
        })]);
    }

    _announce(win, reason) {
        this._announced.add(windowId(win));
        const handler = this._minimized.get(win);
        if (handler) {
            win.disconnect(handler);
            this._minimized.delete(win);
        }
        if (reason === 'relocated' || this._targetGone)
            this._bindTargetWindow(win);
        win.unminimize();
        focusWindow(win);
    }

    _onFocusChanged() {
        if (!this._active || this._suspended)
            return;
        const win = global.display.focus_window;
        if (!win) {
            // Desktop clicked or everything minimized: bring the target back.
            if (!this._nullFocusId) {
                this._nullFocusId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
                    this._nullFocusId = 0;
                    if (this._active && !this._suspended && !global.display.focus_window)
                        this.activateTarget();
                    return GLib.SOURCE_REMOVE;
                });
            }
            return;
        }
        if (this._isAllowed(win))
            return;
        this._later(() => {
            if (global.display.focus_window === win && !this._isAllowed(win)) {
                this._hide(win);
                this.activateTarget();
                this._onBlocked();
            }
        });
    }

    _onWindowCreated(win) {
        if (!this._active)
            return;
        // Let the window finish its setup (transient-for, app) first.
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            if (!this._active || !win.get_compositor_private())
                return GLib.SOURCE_REMOVE;
            if (this._isAllowed(win)) {
                if (this._targetGone && this._target.kind === 'window' && appIdOf(win) === this._target.appId)
                    this._bindTargetWindow(win);
                return GLib.SOURCE_REMOVE;
            }
            const browser = browserOfWindow(win);
            if (browser) {
                const detail = this._allowDetail;
                if (Date.now() < this._allowUntil && detail.browser === browser &&
                    boundsMatch(frameRect(win), detail.bounds)) {
                    this._allowUntil = 0;
                    this._announce(win, detail.reason);
                    return GLib.SOURCE_REMOVE;
                }
                this._addPending(win, browser);
            }
            this._hide(win);
            if (!this._suspended) {
                this.activateTarget();
                this._onBlocked();
            }
            return GLib.SOURCE_REMOVE;
        });
    }
}
