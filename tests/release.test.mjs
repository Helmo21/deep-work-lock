import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {RELEASE, PLACEHOLDER_SITE_URL, chromeExtensionIdOf, extensionDir} from '../scripts/release-config.mjs';

const json = p => JSON.parse(readFileSync(p, 'utf8'));

test('one version everywhere', () => {
    assert.equal(RELEASE.version, '0.2.0');
    assert.equal(json('package.json').version, RELEASE.version);
    assert.equal(json('chrome-extension/manifest.json').version, RELEASE.version);
});

// Task 3 renames the GNOME extension directory to the uuid; until then this stays a todo.
test('gnome metadata carries the version and the extension dir is named after the uuid', {todo: 'task 3'}, () => {
    assert.ok(existsSync(extensionDir('.')), 'extension directory is named after the uuid');
    assert.equal(json(`${extensionDir('.')}/metadata.json`)['version-name'], RELEASE.version);
});

test('chrome extension id derives from the manifest key', () => {
    assert.equal(chromeExtensionIdOf(json('chrome-extension/manifest.json').key), 'jegdmipkacdhhlldnopafmjhakdmddik');
    assert.equal(RELEASE.chromeExtensionId, 'jegdmipkacdhhlldnopafmjhakdmddik');
});

test('ids and uuid', () => {
    assert.equal(RELEASE.geckoId, 'deep-work-lock@deepwork.local');
    assert.equal(RELEASE.hostName, 'org.deepworklock.host');
    assert.equal(RELEASE.uuid, 'deep-work-lock@helmo21.github.io');
});

test('site url is https and the placeholder is recognisable', () => {
    assert.match(RELEASE.siteUrl, /^https:\/\/[^/]+$/);
    assert.equal(PLACEHOLDER_SITE_URL, 'https://example.invalid');
});

test('license', () => {
    assert.match(readFileSync('LICENSE', 'utf8'), /GNU GENERAL PUBLIC LICENSE\s+Version 3/);
});
