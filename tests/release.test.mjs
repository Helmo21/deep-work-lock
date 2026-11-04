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

test('gnome metadata carries the version and the extension dir is named after the uuid', () => {
    assert.ok(existsSync(extensionDir('.')), 'extension directory is named after the uuid');
    assert.equal(json(`${extensionDir('.')}/metadata.json`)['version-name'], RELEASE.version);
});

test('metadata for extensions.gnome.org', () => {
    const m = json(`${extensionDir('.')}/metadata.json`);
    assert.equal(m.uuid, RELEASE.uuid);
    assert.deepEqual(m['shell-version'], ['46', '47', '48', '49']);
    assert.equal(m.url, 'https://github.com/Helmo21/deep-work-lock');
    assert.deepEqual(m['session-modes'], ['user', 'unlock-dialog']);
    assert.match(m.description, /unlock dialog/);
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

test('extension constants match release.json', async () => {
    const c = await import(`../${extensionDir('.')}/lib/constants.js`);
    assert.equal(c.CHROME_EXTENSION_ID, RELEASE.chromeExtensionId);
    assert.equal(c.GECKO_ID, RELEASE.geckoId);
    assert.equal(c.HOST_NAME, RELEASE.hostName);
});

test('every other literal copy of an identifier matches release.json', () => {
    const text = p => readFileSync(p, 'utf8');
    // The browser extension names the native host it talks to.
    assert.match(text('chrome-extension/background.js'), new RegExp(`const HOST = '${RELEASE.hostName}';`));
    // The Firefox build reads the gecko id from release.json.
    assert.match(text('scripts/build-firefox.mjs'), /GECKO_ID = RELEASE\.geckoId;/);
    // dev-install links the extension under its uuid.
    assert.match(text('scripts/dev-install.sh'), new RegExp(`^UUID="${RELEASE.uuid}"$`, 'm'));
    // metadata url points at the repo.
    assert.equal(json(`${extensionDir('.')}/metadata.json`).url, `https://github.com/${RELEASE.repo}`);
    // The public scripts carry placeholders only; prepare-site fills them in.
    const placeholders = {
        SITE_URL: 'SITE_URL', UUID: 'UUID', REPO: 'REPO',
        CHROME_ID: 'CHROME_ID', GECKO_ID: 'GECKO_ID', HOST_NAME: 'HOST_NAME',
    };
    for (const script of ['scripts/install.sh', 'scripts/uninstall.sh']) {
        const body = text(script);
        for (const [name, marker] of Object.entries(placeholders))
            assert.match(body, new RegExp(`^${name}="\\$\\{DWL_${name}:-@@${marker}@@\\}"$`, 'm'), `${script} ${name}`);
        for (const value of [RELEASE.chromeExtensionId, RELEASE.hostName, RELEASE.uuid, RELEASE.repo])
            assert.ok(!body.includes(value), `${script} hard-codes ${value}`);
    }
});
