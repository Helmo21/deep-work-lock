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

function setFromText(schema, key, text) {
    try {
        settingsFor(schema)?.set_value(key, GLib.Variant.parse(null, text, null, null));
    } catch (e) {
        console.warn(`[deep-work-lock] cannot set ${schema} ${key}: ${e.message}`);
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

export function restoreSettings(saved) {
    for (const {schema, key, userValue} of saved ?? []) {
        const settings = settingsFor(schema);
        if (!settings)
            continue;
        if (userValue === null)
            settings.reset(key);
        else
            setFromText(schema, key, userValue);
    }
    Gio.Settings.sync();
}

export function releaseSettings() {
    settingsCache.clear();
}
