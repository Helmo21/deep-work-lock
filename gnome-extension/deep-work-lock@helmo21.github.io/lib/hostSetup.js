// Writes the native-messaging manifests that point Chrome and Firefox at the
// host script bundled in this extension. Never throws: problems are returned.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {HOST_NAME} from './constants.js';
import {nativeHostManifests, hostPathFor} from './hostManifests.js';

const decoder = new TextDecoder();

function readIfExists(path) {
    try {
        return decoder.decode(GLib.file_get_contents(path)[1]);
    } catch (_e) {
        return null;
    }
}

function grantSnapFirefox() {
    // Firefox in a snap asks the WebExtensions portal once per host, and an
    // unanswered dialog is stored as a refusal: grant this one host up front.
    Gio.DBus.session.call_sync(
        'org.freedesktop.impl.portal.PermissionStore',
        '/org/freedesktop/impl/portal/PermissionStore',
        'org.freedesktop.impl.portal.PermissionStore',
        'SetPermission',
        new GLib.Variant('(sbssas)', ['webextensions', true, HOST_NAME, 'snap.firefox', ['yes']]),
        null, Gio.DBusCallFlags.NONE, 2000, null);
}

export function installNativeHost(extensionPath, options = {}) {
    const snapFirefoxPath = options.snapFirefoxPath ?? '/snap/bin/firefox';
    const written = [];
    const errors = [];
    const hostPath = hostPathFor(extensionPath);

    if (GLib.file_test(hostPath, GLib.FileTest.EXISTS)) {
        try {
            if (GLib.chmod(hostPath, 0o755) !== 0)
                errors.push(`cannot make ${hostPath} executable`);
        } catch (e) {
            errors.push(`cannot make ${hostPath} executable: ${e.message}`);
        }
    } else {
        errors.push(`native host script missing: ${hostPath}`);
    }

    const home = GLib.get_home_dir();
    for (const {relativePath, content} of nativeHostManifests(hostPath)) {
        const path = `${home}/${relativePath}`;
        try {
            const text = `${JSON.stringify(content, null, 2)}\n`;
            if (readIfExists(path) === text)
                continue;
            GLib.mkdir_with_parents(GLib.path_get_dirname(path), 0o755);
            GLib.file_set_contents(path, text);
            GLib.chmod(path, 0o644);
            written.push(path);
        } catch (e) {
            errors.push(`cannot write ${path}: ${e.message}`);
        }
    }

    if (GLib.file_test(snapFirefoxPath, GLib.FileTest.EXISTS)) {
        try {
            grantSnapFirefox();
        } catch (e) {
            errors.push(`snap Firefox portal grant failed: ${e.message}`);
        }
    }

    return {written, errors};
}
