// D-Bus glue: the Shell service called by the native hosts, and a client for
// the bridge each host exports (one per browser).

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {BROWSERS, parseExpect} from './policy.js';

const SHELL_NAME = 'org.deepworklock.Shell';
const SHELL_PATH = '/org/deepworklock/Shell';
const CALL_TIMEOUT_MS = 3000;

// ExpectChromeWindow is what version 1 hosts call; it stays until every
// running host has been replaced.
const SHELL_XML = `
<node>
  <interface name="${SHELL_NAME}">
    <method name="GetLock"><arg type="s" direction="out" name="json"/></method>
    <method name="ExpectWindow"><arg type="s" direction="in" name="detail"/></method>
    <method name="ExpectChromeWindow"><arg type="s" direction="in" name="reason"/></method>
  </interface>
</node>`;

export class ShellService {
    /** @param expectWindow ({browser, reason, bounds}) => void */
    constructor({getLock, expectWindow}) {
        this._getLock = getLock;
        this._expectWindow = expectWindow;
    }

    export() {
        this._impl = Gio.DBusExportedObject.wrapJSObject(SHELL_XML, this);
        this._impl.export(Gio.DBus.session, SHELL_PATH);
        this._nameId = Gio.bus_own_name_on_connection(Gio.DBus.session, SHELL_NAME,
            Gio.BusNameOwnerFlags.REPLACE, null, null);
    }

    unexport() {
        this._impl?.unexport();
        this._impl = null;
        if (this._nameId) {
            Gio.bus_unown_name(this._nameId);
            this._nameId = 0;
        }
    }

    GetLock() {
        return JSON.stringify(this._getLock());
    }

    ExpectWindow(detail) {
        this._expectWindow(parseExpect(detail));
    }

    ExpectChromeWindow(detail) {
        this._expectWindow({...parseExpect(detail), browser: 'chrome'});
    }
}

/**
 * Call a browser's native host bridge. Rejects when the browser or its host
 * is absent.
 * @param {'chrome'|'firefox'} browser
 * @param {'ListWindows'|'Lock'|'Unlock'} method
 */
export function browserCall(browser, method, arg = undefined) {
    return new Promise((resolve, reject) => {
        const {bridgeName, bridgePath} = BROWSERS[browser];
        const params = arg === undefined ? null : new GLib.Variant('(s)', [JSON.stringify(arg)]);
        Gio.DBus.session.call(bridgeName, bridgePath, bridgeName, method, params,
            new GLib.VariantType('(s)'), Gio.DBusCallFlags.NO_AUTO_START, CALL_TIMEOUT_MS, null,
            (connection, result) => {
                try {
                    const [json] = connection.call_finish(result).deepUnpack();
                    resolve(JSON.parse(json));
                } catch (e) {
                    reject(e);
                }
            });
    });
}
