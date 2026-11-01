// Top bar UI: the Focus menu (duration + target), the countdown, and the
// "desktop switched off" look during a session.

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import Pango from 'gi://Pango';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {
    DURATION_PRESETS, DEFAULT_DURATION, parseDuration, formatRemaining, lockMessage,
    matchChromeWindows,
} from './policy.js';
import {listWindows, windowId, appIdOf, isChromeWindow} from './windowGuard.js';

const DIM_OPACITY = 90;
const ICON_SIZE = 18;

function ellipsized(text, styleClass) {
    const label = new St.Label({text, style_class: styleClass, x_expand: true,
        y_align: Clutter.ActorAlign.CENTER});
    label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    return label;
}

function header(text) {
    const item = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
    item.add_child(new St.Label({text, style_class: 'dwl-header'}));
    return item;
}

// A selectable row that does not close the menu when clicked.
const TargetItem = GObject.registerClass(
class TargetItem extends PopupMenu.PopupBaseMenuItem {
    _init({icon, title, kindLabel, onSelect}) {
        super._init({style_class: 'dwl-target'});
        if (icon)
            this.add_child(icon);
        this.add_child(ellipsized(title, 'dwl-target-title'));
        this.add_child(new St.Label({text: kindLabel, style_class: 'dwl-kind',
            y_align: Clutter.ActorAlign.CENTER}));
        this._onSelect = onSelect;
    }

    activate(_event) {
        this._onSelect();
    }

    setSelected(selected) {
        if (selected)
            this.add_style_class_name('dwl-selected');
        else
            this.remove_style_class_name('dwl-selected');
    }
});

export const FocusIndicator = GObject.registerClass(
class FocusIndicator extends PanelMenu.Button {
    /**
     * @param onLock ({minutes, target}) => void, target = {kind, metaWindow?, appId?, tabId?, chromeWindowId?}
     * @param chromeCall (method, arg?) => Promise
     */
    _init({onLock, chromeCall}) {
        super._init(0.5, 'Deep Work Lock');
        this._onLock = onLock;
        this._chromeCall = chromeCall;
        this._minutes = DEFAULT_DURATION;
        this._customMode = false;
        this._selection = null;
        this._targetItems = new Map();

        this._label = new St.Label({text: '◉ Focus', y_align: Clutter.ActorAlign.CENTER,
            style_class: 'dwl-focus-idle'});
        this.add_child(this._label);

        this._buildMenu();
        this.menu.connect('open-state-changed', (_menu, open) => {
            if (open)
                this._refreshTargets();
        });
    }

    // ---- states ---------------------------------------------------------

    setIdle() {
        this._label.text = '◉ Focus';
        this._label.style_class = 'dwl-focus-idle';
        this.setSensitive(true);
    }

    setLocked(remainingMs) {
        this.menu.close();
        this.setSensitive(false);
        this._label.style_class = 'dwl-countdown';
        this.tick(remainingMs);
    }

    tick(remainingMs) {
        this._label.text = `🔒 ${formatRemaining(remainingMs)}`;
    }

    // ---- menu -----------------------------------------------------------

    _buildMenu() {
        this.menu.box.add_style_class_name('dwl-menu');
        this.menu.addMenuItem(header('DURÉE'));

        const chipsItem = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        const chips = new St.BoxLayout({style_class: 'dwl-chips'});
        this._chips = new Map();
        for (const minutes of DURATION_PRESETS) {
            const chip = new St.Button({label: String(minutes), style_class: 'dwl-chip', can_focus: true});
            chip.connect('clicked', () => this._choosePreset(minutes));
            chips.add_child(chip);
            this._chips.set(minutes, chip);
        }
        this._customChip = new St.Button({label: '…', style_class: 'dwl-chip', can_focus: true});
        this._customChip.connect('clicked', () => this._chooseCustom());
        chips.add_child(this._customChip);
        this._entry = new St.Entry({hint_text: 'min', style_class: 'dwl-entry', can_focus: true,
            visible: false});
        this._entry.clutter_text.connect('text-changed', () => this._updateGoButton());
        this._entry.clutter_text.connect('activate', () => this._lockNow());
        chips.add_child(this._entry);
        chipsItem.add_child(chips);
        this.menu.addMenuItem(chipsItem);

        this.menu.addMenuItem(header('CIBLE'));
        this._targetsSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._targetsSection);

        const goItem = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        this._goButton = new St.Button({style_class: 'dwl-go', x_expand: true, can_focus: true});
        this._goButton.connect('clicked', () => this._lockNow());
        goItem.add_child(this._goButton);
        this.menu.addMenuItem(goItem);

        this._choosePreset(DEFAULT_DURATION);
    }

    _choosePreset(minutes) {
        this._customMode = false;
        this._minutes = minutes;
        this._entry.hide();
        this._updateGoButton();
    }

    _chooseCustom() {
        this._customMode = true;
        this._entry.show();
        this._entry.grab_key_focus();
        this._updateGoButton();
    }

    _currentMinutes() {
        return this._customMode ? parseDuration(this._entry.get_text()) : this._minutes;
    }

    _updateGoButton() {
        for (const [minutes, chip] of this._chips) {
            if (!this._customMode && minutes === this._minutes)
                chip.add_style_class_name('dwl-chip-on');
            else
                chip.remove_style_class_name('dwl-chip-on');
        }
        if (this._customMode)
            this._customChip.add_style_class_name('dwl-chip-on');
        else
            this._customChip.remove_style_class_name('dwl-chip-on');

        const minutes = this._currentMinutes();
        this._goButton.label = minutes ? `Verrouiller ${minutes} min` : 'Durée invalide (1–600)';
        this._goButton.reactive = !!minutes && !!this._selection;
        if (this._goButton.reactive)
            this._goButton.remove_style_pseudo_class('insensitive');
        else
            this._goButton.add_style_pseudo_class('insensitive');
    }

    _select(selection) {
        this._selection = selection;
        for (const [key, item] of this._targetItems)
            item.setSelected(key === selection.key);
        this._updateGoButton();
    }

    _lockNow() {
        const minutes = this._currentMinutes();
        const sel = this._selection;
        if (!minutes || !sel)
            return;
        if (sel.metaWindow && !sel.metaWindow.get_compositor_private()) {
            this._refreshTargets();
            return;
        }
        this.menu.close();
        this._onLock({minutes, target: sel});
    }

    // ---- targets ----------------------------------------------------------

    _candidateWindows() {
        return listWindows().filter(win =>
            !win.skip_taskbar &&
            win.get_window_type() === 0 /* Meta.WindowType.NORMAL */ &&
            win.get_title());
    }

    async _refreshTargets() {
        this._renderTargets(null);
        const chromeWins = this._candidateWindows().filter(isChromeWindow);
        if (chromeWins.length === 0)
            return;
        try {
            const reply = await this._chromeCall('ListWindows');
            if (this.menu.isOpen)
                this._renderTargets(reply.windows ?? []);
        } catch {
            if (this.menu.isOpen)
                this._renderTargets(null, true);
        }
    }

    _renderTargets(chromeWindows, chromeFailed = false) {
        this._targetsSection.removeAll();
        this._targetItems.clear();
        const tracker = Shell.WindowTracker.get_default();
        const windows = this._candidateWindows();

        const matches = chromeWindows
            ? matchChromeWindows(
                windows.filter(isChromeWindow).map(w => ({id: windowId(w), title: w.get_title()})),
                chromeWindows)
            : new Map();
        const chromeById = new Map((chromeWindows ?? []).map(c => [c.id, c]));

        // Group windows by app, keeping first-seen order.
        const groups = new Map();
        for (const win of windows) {
            const appId = appIdOf(win);
            if (!groups.has(appId))
                groups.set(appId, {app: tracker.get_window_app(win), windows: []});
            groups.get(appId).windows.push(win);
        }

        const iconFor = app => app?.create_icon_texture(ICON_SIZE) ??
            new St.Icon({icon_name: 'application-x-executable-symbolic', icon_size: ICON_SIZE});

        for (const [appId, {app, windows: wins}] of groups) {
            if (wins.length > 1) {
                this._addTarget(this._targetsSection, {
                    key: `app:${appId}`, kind: 'app', appId,
                    icon: iconFor(app), title: app?.get_name() ?? wins[0].get_title(),
                    kindLabel: 'app',
                });
            }
            for (const win of wins) {
                const xid = windowId(win);
                const chromeWin = chromeById.get(matches.get(xid));
                if (chromeWin) {
                    this._addChromeWindow(win, chromeWin, iconFor(app));
                } else {
                    this._addTarget(this._targetsSection, {
                        key: `win:${xid}`, kind: 'window', metaWindow: win, appId,
                        icon: iconFor(app), title: win.get_title(), kindLabel: 'fenêtre',
                    });
                }
            }
        }

        if (chromeFailed) {
            const hint = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
            hint.add_child(new St.Label({text: 'Extension Chrome non connectée : onglets indisponibles',
                style_class: 'dwl-hint'}));
            this._targetsSection.addMenuItem(hint);
        }

        if (this._selection && !this._targetItems.has(this._selection.key))
            this._selection = null;
        if (this._selection)
            this._targetItems.get(this._selection.key).setSelected(true);
        this._updateGoButton();
    }

    _addTarget(section, {icon, title, kindLabel, ...selection}) {
        const item = new TargetItem({icon, title, kindLabel,
            onSelect: () => this._select({...selection, label: title})});
        section.addMenuItem(item);
        this._targetItems.set(selection.key, item);
        return item;
    }

    _addChromeWindow(win, chromeWin, icon) {
        const count = chromeWin.tabs.length;
        const sub = new PopupMenu.PopupSubMenuMenuItem(win.get_title(), true);
        sub.icon.gicon = icon.gicon ?? new Gio.ThemedIcon({name: 'google-chrome'});
        sub.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        sub.label.add_style_class_name('dwl-target-title');
        sub.insert_child_below(new St.Label({text: `${count} onglet${count > 1 ? 's' : ''}`,
            style_class: 'dwl-kind', y_align: Clutter.ActorAlign.CENTER}), sub._triangleBin);
        this._targetsSection.addMenuItem(sub);

        const appId = appIdOf(win);
        this._addTarget(sub.menu, {
            key: `win:${windowId(win)}`, kind: 'window', metaWindow: win, appId,
            chromeWindowId: chromeWin.id, icon: null, title: 'Toute la fenêtre', kindLabel: 'fenêtre',
        });
        for (const tab of chromeWin.tabs) {
            this._addTarget(sub.menu, {
                key: `tab:${tab.id}`, kind: 'tab', metaWindow: win, appId,
                chromeWindowId: chromeWin.id, tabId: tab.id,
                icon: null, title: `${tab.active ? '◉' : '○'} ${tab.title || tab.url}`, kindLabel: 'onglet',
            });
        }
    }
});

/**
 * Greys out and freezes the top bar and the dock, blocks the overview and
 * shows the lock message.
 */
export class SessionChrome {
    constructor({indicator}) {
        this._indicator = indicator;
        this._active = false;
        this._lastFlash = 0;
    }

    enter() {
        if (this._active)
            return;
        this._active = true;
        Main.overview.hide();

        this._dimmed = [];
        const panel = Main.panel;
        const toDim = [panel._leftBox, panel._centerBox,
            ...panel._rightBox.get_children().filter(c => c !== this._indicator.container)];
        for (const actor of toDim) {
            this._dimmed.push([actor, actor.opacity]);
            actor.opacity = DIM_OPACITY;
        }

        this._shields = [];
        this._addShield(Main.panel);
        const docks = this._docks();
        console.log(`[deep-work-lock] shielding top bar and ${docks.length} dock(s)`);
        for (const dock of docks) {
            this._dimmed.push([dock, dock.opacity]);
            dock.opacity = DIM_OPACITY;
            this._addShield(dock);
        }

        this._overridden = [];
        for (const name of ['show', 'toggle', 'showApps']) {
            const own = Object.prototype.hasOwnProperty.call(Main.overview, name);
            this._overridden.push([name, own, Main.overview[name]]);
            Main.overview[name] = () => this._onBlockedHook?.();
        }
        // Gestures reach the overview without going through show(). hide()
        // is a no-op until the overview is fully shown, hence 'shown' too.
        this._overviewIds = ['showing', 'shown'].map(signal =>
            Main.overview.connect(signal, () => {
                Main.overview.hide();
                this._onBlockedHook?.();
            }));
    }

    leave() {
        if (!this._active)
            return;
        this._active = false;
        for (const [actor, opacity] of this._dimmed)
            actor.opacity = opacity;
        this._dimmed = [];
        for (const {shield, covered, signalId} of this._shields) {
            covered.disconnect(signalId);
            shield.destroy();
        }
        this._shields = [];
        for (const [name, own, fn] of this._overridden) {
            if (own)
                Main.overview[name] = fn;
            else
                delete Main.overview[name];
        }
        this._overridden = [];
        for (const id of this._overviewIds ?? [])
            Main.overview.disconnect(id);
        this._overviewIds = [];
    }

    /** Called when something is blocked through the shell UI. */
    set onBlocked(fn) {
        this._onBlockedHook = fn;
    }

    setSuspended(suspended) {
        for (const {shield} of this._shields ?? [])
            shield.visible = !suspended;
        if (!suspended)
            this.sync();
    }

    /** Keep shields on top of what they cover (the dock can move or appear). */
    sync() {
        if (!this._active)
            return;
        const covered = new Set(this._shields.map(s => s.covered));
        for (const dock of this._docks()) {
            if (!covered.has(dock)) {
                this._dimmed.push([dock, dock.opacity]);
                dock.opacity = DIM_OPACITY;
                this._addShield(dock);
            }
        }
        for (const s of this._shields)
            this._place(s);
    }

    flash(remainingMs) {
        const now = Date.now();
        if (now - this._lastFlash < 1000)
            return;
        this._lastFlash = now;
        Main.osdWindowManager.show(-1, new Gio.ThemedIcon({name: 'changes-prevent-symbolic'}),
            lockMessage(remainingMs));
    }

    flashText(text) {
        Main.osdWindowManager.show(-1, new Gio.ThemedIcon({name: 'dialog-warning-symbolic'}), text);
    }

    _docks() {
        return Main.uiGroup.get_children().filter(a => a.name === 'dashtodockContainer');
    }

    _addShield(covered) {
        const shield = new St.Widget({reactive: true, style_class: 'dwl-shield'});
        for (const signal of ['button-press-event', 'touch-event', 'scroll-event']) {
            shield.connect(signal, () => {
                this._onBlockedHook?.();
                return Clutter.EVENT_STOP;
            });
        }
        Main.uiGroup.add_child(shield);
        const entry = {shield, covered, signalId: 0};
        entry.signalId = covered.connect('notify::allocation', () => this._place(entry));
        this._shields.push(entry);
        this._place(entry);
    }

    _place({shield, covered}) {
        if (shield.get_parent() !== Main.uiGroup)
            return;
        const [x, y] = covered.get_transformed_position();
        const [w, h] = covered.get_transformed_size();
        shield.set_position(x, y);
        shield.set_size(w, h);
        if (!Main.sessionMode.isLocked)
            shield.visible = covered.visible;
        Main.uiGroup.set_child_above_sibling(shield, null);
    }
}
