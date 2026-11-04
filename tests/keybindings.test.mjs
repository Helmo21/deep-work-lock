import {test} from 'node:test';
import assert from 'node:assert/strict';
import {neutralizePlan} from '../gnome-extension/deep-work-lock@helmo21.github.io/lib/keybindings.js';

const schemaKeys = {
    'org.gnome.desktop.wm.keybindings': ['switch-applications', 'close', 'panel-run-dialog', 'toggle-maximized', 'switch-to-workspace-1'],
    'org.gnome.shell.keybindings': ['toggle-overview', 'screenshot', 'show-screenshot-ui', 'toggle-quick-settings'],
    'org.gnome.mutter.keybindings': ['toggle-tiled-left'],
    'org.gnome.settings-daemon.plugins.media-keys': ['terminal', 'terminal-static', 'screensaver', 'logout', 'volume-up', 'custom-keybindings'],
    'org.gnome.mutter': ['overlay-key'],
    'org.gnome.desktop.interface': ['enable-hot-corners'],
    'org.gnome.desktop.notifications': ['show-banners'],
    'org.gnome.shell.extensions.dash-to-dock': ['hot-keys'],
};

const find = (plan, schema, key) => plan.find(p => p.schema === schema && p.key === key);

test('neutralizePlan', () => {
    const plan = neutralizePlan(schemaKeys);
    const wm = 'org.gnome.desktop.wm.keybindings';
    assert.deepEqual(find(plan, wm, 'switch-applications'), {schema: wm, key: 'switch-applications', value: '@as []'});
    assert.ok(find(plan, wm, 'panel-run-dialog'));
    assert.ok(find(plan, wm, 'switch-to-workspace-1'));
    assert.equal(find(plan, wm, 'close'), undefined);
    assert.equal(find(plan, wm, 'toggle-maximized'), undefined);

    const sh = 'org.gnome.shell.keybindings';
    assert.ok(find(plan, sh, 'toggle-overview'));
    assert.ok(find(plan, sh, 'toggle-quick-settings'));
    assert.equal(find(plan, sh, 'screenshot'), undefined);

    assert.equal(plan.some(p => p.schema === 'org.gnome.mutter.keybindings'), false);

    const mk = 'org.gnome.settings-daemon.plugins.media-keys';
    assert.ok(find(plan, mk, 'terminal'));
    assert.ok(find(plan, mk, 'terminal-static'));
    assert.ok(find(plan, mk, 'logout'));
    assert.ok(find(plan, mk, 'custom-keybindings'));
    assert.equal(find(plan, mk, 'screensaver'), undefined);
    assert.equal(find(plan, mk, 'volume-up'), undefined);

    assert.equal(find(plan, 'org.gnome.mutter', 'overlay-key').value, "''");
    assert.equal(find(plan, 'org.gnome.desktop.interface', 'enable-hot-corners').value, 'false');
    assert.equal(find(plan, 'org.gnome.desktop.notifications', 'show-banners').value, 'false');
    assert.equal(find(plan, 'org.gnome.shell.extensions.dash-to-dock', 'hot-keys').value, 'false');
});

test('neutralizePlan skips missing schemas and keys', () => {
    const plan = neutralizePlan({'org.gnome.mutter': ['overlay-key']});
    assert.deepEqual(plan, [{schema: 'org.gnome.mutter', key: 'overlay-key', value: "''"}]);
});
