// Pure: which GSettings keys to change during a session, and to what.
// Values are GVariant text so they can be parsed with GLib.Variant.parse.

const EMPTY = '@as []';

// Window management keys that only act on the focused (target) window.
const WM_KEEP = new Set([
    'close', 'maximize', 'unmaximize', 'toggle-maximized', 'toggle-fullscreen',
    'begin-move', 'begin-resize', 'minimize',
    // keyboard layout switching is harmless and needed to type
    'switch-input-source', 'switch-input-source-backward',
]);

const SHELL_KEEP = new Set(['screenshot', 'screenshot-window', 'show-screenshot-ui']);

// Media keys that launch something. Super+L (screensaver) stays.
const MEDIA_LAUNCHERS = [
    'terminal', 'logout', 'home', 'www', 'email', 'calculator', 'search',
    'control-center', 'help',
];

const SINGLE_KEYS = [
    ['org.gnome.mutter', 'overlay-key', "''"],
    ['org.gnome.desktop.interface', 'enable-hot-corners', 'false'],
    ['org.gnome.desktop.notifications', 'show-banners', 'false'],
    ['org.gnome.shell.extensions.dash-to-dock', 'hot-keys', 'false'],
];

/**
 * @param {Record<string, string[]>} schemaKeys keys present in each installed schema
 * @returns {{schema: string, key: string, value: string}[]}
 */
export function neutralizePlan(schemaKeys) {
    const plan = [];
    const add = (schema, key, value) => plan.push({schema, key, value});

    for (const key of schemaKeys['org.gnome.desktop.wm.keybindings'] ?? []) {
        if (!WM_KEEP.has(key))
            add('org.gnome.desktop.wm.keybindings', key, EMPTY);
    }
    for (const key of schemaKeys['org.gnome.shell.keybindings'] ?? []) {
        if (!SHELL_KEEP.has(key))
            add('org.gnome.shell.keybindings', key, EMPTY);
    }

    const media = 'org.gnome.settings-daemon.plugins.media-keys';
    const mediaKeys = new Set(schemaKeys[media] ?? []);
    for (const base of MEDIA_LAUNCHERS) {
        for (const key of [base, `${base}-static`]) {
            if (mediaKeys.has(key))
                add(media, key, EMPTY);
        }
    }
    if (mediaKeys.has('custom-keybindings'))
        add(media, 'custom-keybindings', EMPTY);

    for (const [schema, key, value] of SINGLE_KEYS) {
        if ((schemaKeys[schema] ?? []).includes(key))
            add(schema, key, value);
    }
    return plan;
}

export const SCHEMAS = [
    'org.gnome.desktop.wm.keybindings',
    'org.gnome.shell.keybindings',
    'org.gnome.settings-daemon.plugins.media-keys',
    ...new Set(SINGLE_KEYS.map(([schema]) => schema)),
];
