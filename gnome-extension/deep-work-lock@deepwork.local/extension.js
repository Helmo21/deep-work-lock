// Deep Work Lock: keeps one window, app or Chrome tab in front until the
// timer runs out. There is deliberately no way to stop a session early.

import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {decideStartup} from './lib/policy.js';
import {readState, writeState, clearState, currentBootId} from './lib/stateStore.js';
import {captureAndApply, applyPlan, restoreSettings, releaseSettings} from './lib/settingsGuard.js';
import {WindowGuard, windowId, appIdOf, isChromeWindow} from './lib/windowGuard.js';
import {FocusIndicator, SessionChrome} from './lib/panel.js';
import {ShellService, chromeCall} from './lib/dbus.js';

const log = msg => console.log(`[deep-work-lock] ${msg}`);

export default class DeepWorkLockExtension extends Extension {
    enable() {
        this._session = null;

        this._indicator = new FocusIndicator({
            onLock: ({minutes, target}) => this._lock(minutes, target),
            chromeCall,
        });
        Main.panel.addToStatusArea(this.uuid, this._indicator, 0, 'right');

        this._chrome = new SessionChrome({indicator: this._indicator});
        this._chrome.onBlocked = () => this._flash();
        this._guard = new WindowGuard({onBlocked: () => this._flash()});

        this._service = new ShellService({
            getLock: () => this._lockInfo(),
            expectChromeWindow: reason => this._guard.expectChromeWindow(reason),
        });
        this._service.export();

        this._sessionModeId = Main.sessionMode.connect('updated', () => this._onSessionModeUpdated());

        const state = readState();
        switch (decideStartup(state, currentBootId(), Date.now())) {
        case 'restore':
            log('previous session found after reboot or expiry: restoring settings');
            restoreSettings(state.saved);
            clearState();
            break;
        case 'resume':
            log('resuming session after a GNOME Shell restart');
            applyPlan();
            this._startSession(state);
            break;
        }
    }

    disable() {
        if (this._session) {
            this._stopEnforcement();
            restoreSettings(this._session.saved);
            // Keep the file while time remains, so a Shell restart resumes.
            if (Date.now() >= this._session.endsAt)
                clearState();
            this._session = null;
        }
        Main.sessionMode.disconnect(this._sessionModeId);
        this._service.unexport();
        this._indicator.destroy();
        releaseSettings();
        this._indicator = null;
        this._chrome = null;
        this._guard = null;
        this._service = null;
    }

    // ---- session lifecycle ------------------------------------------------

    _lock(minutes, uiTarget) {
        if (this._session)
            return;
        const now = Date.now();
        const win = uiTarget.metaWindow ?? null;
        const state = {
            version: 1,
            bootId: currentBootId(),
            startedAt: now,
            endsAt: now + minutes * 60_000,
            target: {
                kind: uiTarget.kind,
                windowId: win && uiTarget.kind !== 'app' ? windowId(win) : null,
                appId: uiTarget.appId ?? (win ? appIdOf(win) : null),
                tabId: uiTarget.tabId ?? null,
                chromeWindowId: uiTarget.chromeWindowId ?? null,
                label: uiTarget.label ?? '',
            },
            chrome: null,
            saved: [],
        };

        // Persist the original values before touching anything.
        captureAndApply(saved => {
            state.saved = saved;
            writeState(state);
        });
        this._startSession(state);

        const chromeLock = this._chromeLockRequest(state, win);
        if (chromeLock) {
            chromeCall('Lock', chromeLock).then(lock => {
                if (this._session !== state)
                    return;
                state.chrome = lock;
                writeState(state);
            }).catch(e => {
                log(`Chrome lock failed: ${e.message}`);
                if (state.target.kind === 'tab')
                    this._chrome.flashText('Chrome injoignable : verrou limité à la fenêtre');
            });
        }
    }

    _chromeLockRequest(state, win) {
        const {kind, tabId, chromeWindowId} = state.target;
        if (kind === 'tab')
            return {kind: 'tab', tabId, windowId: chromeWindowId, endsAt: state.endsAt};
        if (kind === 'window' && win && isChromeWindow(win) && chromeWindowId !== null)
            return {kind: 'window', windowId: chromeWindowId, endsAt: state.endsAt};
        return null;
    }

    _startSession(state) {
        this._session = state;
        const {kind, windowId: id, appId} = state.target;
        this._guard.start({kind, windowId: id, appId});
        this._chrome.enter();
        this._indicator.setLocked(this._remaining());
        this._tickId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => this._tick());
        this._onSessionModeUpdated();
    }

    _tick() {
        const remaining = this._remaining();
        if (remaining <= 0) {
            this._tickId = 0;
            this._endSession();
            return GLib.SOURCE_REMOVE;
        }
        this._indicator.tick(remaining);
        this._chrome.sync();
        return GLib.SOURCE_CONTINUE;
    }

    _endSession() {
        const state = this._session;
        this._stopEnforcement();
        restoreSettings(state.saved);
        clearState();
        this._session = null;
        this._indicator.setIdle();
        chromeCall('Unlock').catch(() => {});
        global.display.get_sound_player().play_from_theme('complete', 'Session Deep Work terminée', null);
        log('session finished');
    }

    _stopEnforcement() {
        if (this._tickId) {
            GLib.source_remove(this._tickId);
            this._tickId = 0;
        }
        this._guard.stop();
        this._chrome.leave();
    }

    // ---- helpers ------------------------------------------------------------

    _remaining() {
        return this._session ? this._session.endsAt - Date.now() : 0;
    }

    _flash() {
        if (this._session && !Main.sessionMode.isLocked)
            this._chrome.flash(this._remaining());
    }

    _lockInfo() {
        if (!this._session)
            return {active: false};
        return {active: true, endsAt: this._session.endsAt, chrome: this._session.chrome};
    }

    _onSessionModeUpdated() {
        if (!this._session)
            return;
        const locked = Main.sessionMode.isLocked;
        this._guard.setSuspended(locked);
        this._chrome.setSuspended(locked);
        if (!locked)
            this._indicator.container.show();
    }
}
