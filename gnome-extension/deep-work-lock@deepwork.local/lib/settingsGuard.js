// Applies and restores the GSettings changes made during a session.

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {neutralizePlan, SCHEMAS} from './keybindings.js';

function lookupSchema(id) {
    return Gio.SettingsSchemaSource.get_default()?.lookup(id, true) ?? null;
}

function installedSchemaKeys() {
    const result = {};
    for (const id of SCHEMAS) {
        const schema = lookupSchema(id);
        if (schema)
            result[id] = schema.list_keys();
    }
    return result;
}

const settingsCache = new Map();
function settingsFor(id) {
    if (!lookupSchema(id))
        return null;
    if (!settingsCache.has(id))
        settingsCache.set(id, new Gio.Settings({schema_id: id}));
    return settingsCache.get(id);
}

// Writing a key the schema lacks aborts the whole process (g_error), so every
// write checks the key first. Returns false when the value was not applied.
function hasKey(schema, key) {
    return lookupSchema(schema)?.has_key(key) ?? false;
}

function setFromText(schema, key, text) {
    if (!hasKey(schema, key))
        return false;
    try {
        const type = lookupSchema(schema).get_key(key).get_value_type();
        settingsFor(schema).set_value(key, GLib.Variant.parse(type, text, null, null));
        return true;
    } catch (e) {
        console.warn(`[deep-work-lock] cannot set ${schema} ${key}: ${e.message}`);
        return false;
    }
}

/**
 * Capture the current user values, hand them to onSaved (which must persist
 * them), then neutralize. Returns the saved list.
 */
export function captureAndApply(onSaved) {
    const plan = neutralizePlan(installedSchemaKeys());
    const saved = plan.map(({schema, key}) => {
        const userValue = settingsFor(schema).get_user_value(key);
        return {schema, key, userValue: userValue ? userValue.print(true) : null};
    });
    onSaved(saved);
    applyPlan(plan);
    return saved;
}

/** Re-apply the neutral values without capturing (resume after restart). */
export function applyPlan(plan = neutralizePlan(installedSchemaKeys())) {
    for (const {schema, key, value} of plan)
        setFromText(schema, key, value);
    Gio.Settings.sync();
}

/** Put saved values back. Keys that no longer exist are skipped. */
export function restoreSettings(saved) {
    for (const {schema, key, userValue} of saved ?? []) {
        if (!hasKey(schema, key))
            continue;
        if (userValue === null)
            settingsFor(schema).reset(key);
        else
            setFromText(schema, key, userValue);
    }
    Gio.Settings.sync();
}

export function releaseSettings() {
    settingsCache.clear();
}
