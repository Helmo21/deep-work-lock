// D-Bus glue: the Shell service called by the native host, and a client for
// the bridge the host exports.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const SHELL_NAME = 'org.deepworklock.Shell';
const SHELL_PATH = '/org/deepworklock/Shell';
const BRIDGE_NAME = 'org.deepworklock.ChromeBridge';
const BRIDGE_PATH = '/org/deepworklock/ChromeBridge';
const CALL_TIMEOUT_MS = 3000;

const SHELL_XML = `
<node>
  <interface name="${SHELL_NAME}">
    <method name="GetLock"><arg type="s" direction="out" name="json"/></method>
    <method name="ExpectChromeWindow"><arg type="s" direction="in" name="reason"/></method>
  </interface>
</node>`;

export class ShellService {
    constructor({getLock, expectChromeWindow}) {
        this._getLock = getLock;
        this._expectChromeWindow = expectChromeWindow;
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

    ExpectChromeWindow(reason) {
        this._expectChromeWindow(reason);
    }
}

/**
 * Call the native host bridge. Rejects when Chrome or the host is absent.
 * @param {'ListWindows'|'Lock'|'Unlock'} method
 */
export function chromeCall(method, arg = undefined) {
    return new Promise((resolve, reject) => {
        const params = arg === undefined ? null : new GLib.Variant('(s)', [JSON.stringify(arg)]);
        Gio.DBus.session.call(BRIDGE_NAME, BRIDGE_PATH, BRIDGE_NAME, method, params,
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
