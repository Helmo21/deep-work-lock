#!/usr/bin/python3
"""Native messaging host: bridges the Chrome extension and the GNOME Shell
extension over the D-Bus session bus.

Chrome <-> host: JSON messages with a 4-byte native-endian length prefix.
Host exports org.deepworklock.ChromeBridge and calls org.deepworklock.Shell.
"""

import itertools
import json
import os
import struct
import sys
import time

BRIDGE_NAME = "org.deepworklock.ChromeBridge"
BRIDGE_PATH = "/org/deepworklock/ChromeBridge"
SHELL_NAME = "org.deepworklock.Shell"
SHELL_PATH = "/org/deepworklock/Shell"
REQUEST_TIMEOUT = 3.0

BRIDGE_XML = """
<node>
  <interface name="org.deepworklock.ChromeBridge">
    <method name="ListWindows"><arg type="s" direction="out" name="json"/></method>
    <method name="Lock">
      <arg type="s" direction="in" name="request"/>
      <arg type="s" direction="out" name="json"/>
    </method>
    <method name="Unlock"><arg type="s" direction="out" name="json"/></method>
  </interface>
</node>
"""

DBUS_TO_CHROME = {"ListWindows": "listWindows", "Lock": "lock", "Unlock": "unlock"}


def log(*args):
    print("[deep-work-lock-host]", *args, file=sys.stderr, flush=True)


def encode_message(obj):
    data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    return struct.pack("=I", len(data)) + data


class FrameReader:
    """Accumulates bytes from stdin and yields complete messages."""

    def __init__(self):
        self._buffer = b""

    def feed(self, chunk):
        self._buffer += chunk
        messages = []
        while len(self._buffer) >= 4:
            (length,) = struct.unpack("=I", self._buffer[:4])
            if len(self._buffer) < 4 + length:
                break
            payload = self._buffer[4:4 + length]
            self._buffer = self._buffer[4 + length:]
            messages.append(json.loads(payload.decode("utf-8")))
        return messages


class PendingRequests:
    """D-Bus invocations waiting for a reply from Chrome."""

    def __init__(self, timeout=REQUEST_TIMEOUT):
        self._timeout = timeout
        self._ids = itertools.count(1)
        self._items = {}

    def add(self, invocation, now=None):
        rid = next(self._ids)
        self._items[rid] = (invocation, time.monotonic() if now is None else now)
        return rid

    def resolve(self, rid):
        item = self._items.pop(rid, None)
        return item[0] if item else None

    def expire(self, now=None):
        now = time.monotonic() if now is None else now
        old = [rid for rid, (_, t) in self._items.items() if now - t >= self._timeout]
        return [self._items.pop(rid)[0] for rid in old]


class Bridge:
    def __init__(self):
        from gi.repository import Gio, GLib

        self.Gio = Gio
        self.GLib = GLib
        self.loop = GLib.MainLoop()
        self.reader = FrameReader()
        self.pending = PendingRequests()
        self.connection = None

    # ---- Chrome side -------------------------------------------------
    def send(self, obj):
        sys.stdout.buffer.write(encode_message(obj))
        sys.stdout.buffer.flush()

    def on_stdin(self, fd, condition):
        # Any exception here would silently remove the watch, so catch all.
        try:
            chunk = os.read(fd, 65536) if condition & self.GLib.IO_IN else b""
            if not chunk:
                log("stdin closed, exiting")
                self.loop.quit()
                return False
            for message in self.reader.feed(chunk):
                try:
                    self.on_chrome_message(message)
                except Exception as error:  # noqa: BLE001
                    log(f"error handling {message!r}: {error}")
        except Exception as error:  # noqa: BLE001
            log(f"stdin error: {error}")
        return True

    def on_chrome_message(self, message):
        if "replyTo" in message:
            invocation = self.pending.resolve(message["replyTo"])
            if invocation is None:
                return
            if message.get("ok"):
                payload = json.dumps(message.get("data"))
                invocation.return_value(self.GLib.Variant("(s)", (payload,)))
            else:
                invocation.return_dbus_error(
                    "org.deepworklock.Error", str(message.get("error", "unknown error")))
            return

        kind = message.get("type")
        if kind == "getLock":
            self.call_shell("GetLock", None, self._reply_lock_state)
        elif kind == "expectWindow":
            detail = {"reason": str(message.get("reason", "popup")), "bounds": message.get("bounds")}
            arg = self.GLib.Variant("(s)", (json.dumps(detail),))
            self.call_shell("ExpectChromeWindow", arg, None)
        elif kind == "hello":
            log("Chrome extension connected")

    def _reply_lock_state(self, result):
        data = None
        if result is not None:
            try:
                data = json.loads(result.unpack()[0])
            except (ValueError, TypeError):
                data = None
        self.send({"type": "lockState", "data": data})

    # ---- D-Bus side --------------------------------------------------
    def call_shell(self, method, args, callback):
        if self.connection is None:
            if callback:
                callback(None)
            return

        def done(conn, res):
            try:
                result = conn.call_finish(res)
            except self.GLib.Error as error:
                log(f"Shell.{method} failed: {error.message}")
                result = None
            if callback:
                callback(result)

        self.connection.call(
            SHELL_NAME, SHELL_PATH, SHELL_NAME, method, args, None,
            self.Gio.DBusCallFlags.NONE, int(REQUEST_TIMEOUT * 1000), None, done)

    def on_method_call(self, conn, sender, path, iface, method, params, invocation):
        chrome_type = DBUS_TO_CHROME.get(method)
        if chrome_type is None:
            invocation.return_dbus_error("org.freedesktop.DBus.Error.UnknownMethod", method)
            return
        payload = None
        if method == "Lock":
            try:
                payload = json.loads(params.unpack()[0])
            except ValueError:
                invocation.return_dbus_error("org.deepworklock.Error", "invalid JSON")
                return
        rid = self.pending.add(invocation)
        self.send({"id": rid, "type": chrome_type, "payload": payload})

    def expire_requests(self):
        for invocation in self.pending.expire():
            invocation.return_dbus_error("org.deepworklock.Error.Timeout", "Chrome did not answer")
        return True

    def run(self):
        # Connect synchronously so Chrome's first messages can be answered.
        self.connection = self.Gio.bus_get_sync(self.Gio.BusType.SESSION, None)
        info = self.Gio.DBusNodeInfo.new_for_xml(BRIDGE_XML)
        self.connection.register_object(BRIDGE_PATH, info.interfaces[0],
                                        self.on_method_call, None, None)
        flags = (self.Gio.BusNameOwnerFlags.REPLACE
                 | self.Gio.BusNameOwnerFlags.ALLOW_REPLACEMENT)
        self.Gio.bus_own_name_on_connection(self.connection, BRIDGE_NAME, flags, None, None)
        self.GLib.io_add_watch(0, self.GLib.PRIORITY_DEFAULT,
                               self.GLib.IO_IN | self.GLib.IO_HUP | self.GLib.IO_ERR,
                               self.on_stdin)
        self.GLib.timeout_add_seconds(1, self.expire_requests)
        self.loop.run()


if __name__ == "__main__":
    Bridge().run()
