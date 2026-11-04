// Run with: HOME=$(mktemp -d) gjs -m tests/gjs/host-setup.test.js
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {installNativeHost} from '../../gnome-extension/deep-work-lock@helmo21.github.io/lib/hostSetup.js';

const home = GLib.get_home_dir();
if (!home.startsWith('/tmp/') || GLib.getenv('HOME') !== home)
    throw new Error(`refusing to run with HOME=${home}: must be a temp dir under /tmp`);

const assert = (cond, msg) => { if (!cond) throw new Error(`FAIL: ${msg}`); };
const mkdirs = p => GLib.mkdir_with_parents(p, 0o755);
const read = p => new TextDecoder().decode(GLib.file_get_contents(p)[1]);

const ext = `${home}/ext`;
mkdirs(`${ext}/native-host`);
const script = `${ext}/native-host/deep_work_lock_host.py`;
GLib.file_set_contents(script, '#!/usr/bin/env python3\n');
GLib.chmod(script, 0o644);

// leftover manifest from the old developer install
const chromeManifest = `${home}/.config/google-chrome/NativeMessagingHosts/org.deepworklock.host.json`;
mkdirs(`${home}/.config/google-chrome/NativeMessagingHosts`);
GLib.file_set_contents(chromeManifest, JSON.stringify({
    name: 'org.deepworklock.host', path: '/home/u/.local/share/deep-work-lock/deep_work_lock_host.py',
}));

const options = {snapFirefoxPath: `${home}/no-such-snap-firefox`};
const first = installNativeHost(ext, options);
assert(first.errors.length === 0, `no errors, got ${JSON.stringify(first.errors)}`);
assert(first.written.length === 2, `two manifests written, got ${first.written.length}`);
assert(JSON.parse(read(chromeManifest)).path === script, 'chrome manifest points at the bundled host');
const ffManifest = `${home}/.mozilla/native-messaging-hosts/org.deepworklock.host.json`;
assert(GLib.file_test(ffManifest, GLib.FileTest.EXISTS), 'firefox manifest exists');
const mode = Gio.File.new_for_path(script)
    .query_info('unix::mode', Gio.FileQueryInfoFlags.NONE, null).get_attribute_uint32('unix::mode');
assert((mode & 0o111) === 0o111, `host script executable, mode ${mode.toString(8)}`);
const mmode = Gio.File.new_for_path(chromeManifest)
    .query_info('unix::mode', Gio.FileQueryInfoFlags.NONE, null).get_attribute_uint32('unix::mode');
assert((mmode & 0o777) === 0o644, `manifest mode 0644, got ${(mmode & 0o777).toString(8)}`);

const second = installNativeHost(ext, options);
assert(second.errors.length === 0, 'second run has no errors');
assert(second.written.length === 0, `second run writes nothing, got ${JSON.stringify(second.written)}`);

// a missing host script is reported, never thrown
const broken = installNativeHost(`${home}/nowhere`, options);
assert(broken.errors.length > 0, 'missing script reported in errors');

print('host-setup.test.js: all assertions passed');
