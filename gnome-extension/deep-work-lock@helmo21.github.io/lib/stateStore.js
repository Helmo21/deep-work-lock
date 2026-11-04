// Session file on disk. It holds the original settings so they can be put
// back after a crash, a GNOME Shell restart or a reboot.

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export const STATE_DIR = GLib.build_filenamev([GLib.get_user_state_dir(), 'deep-work-lock']);
export const STATE_PATH = GLib.build_filenamev([STATE_DIR, 'session.json']);

const decoder = new TextDecoder();
const encoder = new TextEncoder();

export function readState() {
    try {
        const [, bytes] = Gio.File.new_for_path(STATE_PATH).load_contents(null);
        return JSON.parse(decoder.decode(bytes));
    } catch {
        return null;
    }
}

export function writeState(state) {
    GLib.mkdir_with_parents(STATE_DIR, 0o700);
    Gio.File.new_for_path(STATE_PATH).replace_contents(
        encoder.encode(JSON.stringify(state, null, 2)), null, false,
        Gio.FileCreateFlags.REPLACE_DESTINATION | Gio.FileCreateFlags.PRIVATE, null);
}

export function clearState() {
    try {
        Gio.File.new_for_path(STATE_PATH).delete(null);
    } catch {
        // already gone
    }
}

export function currentBootId() {
    try {
        const [, bytes] = GLib.file_get_contents('/proc/sys/kernel/random/boot_id');
        return decoder.decode(bytes).trim();
    } catch {
        return 'unknown';
    }
}

/** `${pid}:${starttime}` of this process, from /proc/self/stat; 'unknown' on failure. */
export function currentShellInstance() {
    try {
        const [, bytes] = GLib.file_get_contents('/proc/self/stat');
        const text = decoder.decode(bytes);
        // comm (field 2) is parenthesised and may contain spaces: split after the last ')'.
        const rest = text.slice(text.lastIndexOf(')') + 1).trim().split(/\s+/);
        const pid = text.slice(0, text.indexOf(' '));
        const start = rest[19]; // field 22, with rest[0] being field 3
        if (!/^\d+$/.test(pid) || !/^\d+$/.test(start ?? ''))
            return 'unknown';
        return `${pid}:${start}`;
    } catch {
        return 'unknown';
    }
}
