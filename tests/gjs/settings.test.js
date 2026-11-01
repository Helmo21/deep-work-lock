// Run with: GSETTINGS_BACKEND=memory gjs -m tests/gjs/settings.test.js
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {captureAndApply, restoreSettings} from '../../gnome-extension/deep-work-lock@deepwork.local/lib/settingsGuard.js';

if (GLib.getenv('GSETTINGS_BACKEND') !== 'memory')
    throw new Error('refusing to run without GSETTINGS_BACKEND=memory');

const wm = new Gio.Settings({schema_id: 'org.gnome.desktop.wm.keybindings'});
const mutter = new Gio.Settings({schema_id: 'org.gnome.mutter'});
const media = new Gio.Settings({schema_id: 'org.gnome.settings-daemon.plugins.media-keys'});
const assert = (cond, msg) => { if (!cond) throw new Error(`FAIL: ${msg}`); };

// a user-customized key and a default key
wm.set_strv('switch-windows', ['<Super>w']);
const defaultSwitchApps = wm.get_strv('switch-applications');

let persisted = null;
const saved = captureAndApply(s => { persisted = JSON.parse(JSON.stringify(s)); });
assert(persisted && persisted.length === saved.length, 'onSaved called before applying');
assert(wm.get_strv('switch-applications').length === 0, 'Alt+Tab disabled');
assert(wm.get_strv('close').length > 0, 'close kept');
assert(mutter.get_string('overlay-key') === '', 'Super disabled');
assert(media.get_strv('screensaver').length > 0, 'Super+L kept');

restoreSettings(persisted);
assert(JSON.stringify(wm.get_strv('switch-windows')) === '["<Super>w"]', 'user value restored');
assert(wm.get_user_value('switch-applications') === null, 'default key reset, not pinned');
assert(JSON.stringify(wm.get_strv('switch-applications')) === JSON.stringify(defaultSwitchApps), 'default value back');
assert(mutter.get_string('overlay-key') === 'Super_L', 'overlay key back');
// a saved entry for a key or schema that no longer exists must be skipped, not abort
restoreSettings([
    {schema: 'org.gnome.mutter', key: 'no-such-key', userValue: "'x'"},
    {schema: 'org.example.missing', key: 'k', userValue: null},
    {schema: 'org.gnome.mutter', key: 'overlay-key', userValue: "'Super_R'"},
]);
assert(mutter.get_string('overlay-key') === 'Super_R', 'valid entries still restored after missing ones');
print('settings.test.js: all assertions passed');
