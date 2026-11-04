import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {firefoxManifest, GECKO_ID} from '../scripts/build-firefox.mjs';
import {RELEASE} from '../scripts/release-config.mjs';

test('firefox manifest', () => {
    const chrome = JSON.parse(readFileSync('chrome-extension/manifest.json', 'utf8'));
    const ff = firefoxManifest(chrome);
    assert.equal(GECKO_ID, 'deep-work-lock@deepwork.local');
    assert.equal(ff.manifest_version, 3);
    assert.equal(ff.version, chrome.version);
    assert.equal(ff.name, chrome.name);
    assert.equal('key' in ff, false);
    assert.equal('minimum_chrome_version' in ff, false);
    assert.deepEqual(ff.background, {scripts: ['background.js'], type: 'module'});
    assert.deepEqual(ff.browser_specific_settings, {gecko: {id: 'deep-work-lock@deepwork.local',
        strict_min_version: '140.0', data_collection_permissions: {required: ['none']},
        update_url: `${RELEASE.siteUrl}/updates.json`}});
    assert.deepEqual(firefoxManifest(chrome, 'https://dwl.test').browser_specific_settings.gecko.update_url, 'https://dwl.test/updates.json');
    assert.deepEqual(ff.icons, chrome.icons);
    assert.deepEqual(ff.permissions, chrome.permissions);
    assert.deepEqual(ff.host_permissions, chrome.host_permissions);
    assert.ok(chrome.key.length > 0); // the Chrome manifest is not modified
});
