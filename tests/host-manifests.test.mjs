import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativeHostManifests, hostPathFor} from '../gnome-extension/deep-work-lock@helmo21.github.io/lib/hostManifests.js';
import {RELEASE} from '../scripts/release-config.mjs';

test('manifests point at the bundled host', () => {
    const host = hostPathFor('/home/u/.local/share/gnome-shell/extensions/x');
    assert.equal(host, '/home/u/.local/share/gnome-shell/extensions/x/native-host/deep_work_lock_host.py');
    const [chrome, firefox] = nativeHostManifests(host);
    assert.equal(chrome.relativePath, '.config/google-chrome/NativeMessagingHosts/org.deepworklock.host.json');
    assert.deepEqual(chrome.content, {name: 'org.deepworklock.host',
        description: 'Deep Work Lock bridge between Chrome and GNOME Shell', path: host, type: 'stdio',
        allowed_origins: [`chrome-extension://${RELEASE.chromeExtensionId}/`]});
    assert.equal(firefox.relativePath, '.mozilla/native-messaging-hosts/org.deepworklock.host.json');
    assert.deepEqual(firefox.content.allowed_extensions, [RELEASE.geckoId]);
    assert.equal(firefox.content.path, host);
});
