import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, symlinkSync, existsSync, readFileSync, statSync} from 'node:fs';
import {spawnSync, execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildGnome} from '../scripts/build-gnome.mjs';
import {buildChrome} from '../scripts/build-chrome.mjs';
import {RELEASE} from '../scripts/release-config.mjs';
import {prepareSite} from '../scripts/prepare-site.mjs';

test('gnome zip carries the host at the root layout e.g.o expects', () => {
    const out = mkdtempSync(join(tmpdir(), 'dwl-'));
    const {dir, zip} = buildGnome(out);
    assert.ok(existsSync(join(dir, 'native-host', 'deep_work_lock_host.py')));
    assert.equal(statSync(join(dir, 'native-host', 'deep_work_lock_host.py')).mode & 0o111, 0o111);
    assert.ok(existsSync(join(dir, 'LICENSE')));
    const listing = execFileSync('unzip', ['-Z1', zip], {encoding: 'utf8'});
    assert.match(listing, /^metadata\.json$/m);
    assert.match(listing, /^extension\.js$/m);
    assert.match(listing, /^native-host\/deep_work_lock_host\.py$/m);
    assert.doesNotMatch(listing, /__pycache__/);
});

test('chrome zip', () => {
    const out = mkdtempSync(join(tmpdir(), 'dwl-'));
    const {zip} = buildChrome(out);
    assert.equal(zip, join(out, `deep-work-lock-chrome-${RELEASE.version}.zip`));
    const listing = execFileSync('unzip', ['-Z1', zip], {encoding: 'utf8'});
    for (const f of ['manifest.json', 'background.js', 'lock.js', 'icons/icon-128.png'])
        assert.match(listing, new RegExp(`^${f.replace('.', '\\.')}$`, 'm'));
});

test('chrome build keeps the manifest key by default, --store drops it', () => {
    const source = readFileSync('chrome-extension/manifest.json', 'utf8');
    const dev = buildChrome(mkdtempSync(join(tmpdir(), 'dwl-')));
    assert.equal(readFileSync(join(dev.dir, 'manifest.json'), 'utf8'), source);
    const store = buildChrome(mkdtempSync(join(tmpdir(), 'dwl-')), {store: true});
    const zipped = JSON.parse(execFileSync('unzip', ['-p', store.zip, 'manifest.json'], {encoding: 'utf8'}));
    const {key, ...rest} = JSON.parse(source);
    assert.ok(key);
    assert.deepEqual(zipped, rest);
    const cli = mkdtempSync(join(tmpdir(), 'dwl-'));
    execFileSync('node', ['scripts/build-chrome.mjs', '--store', cli]);
    assert.ok(!('key' in JSON.parse(readFileSync(join(cli, 'chrome', 'manifest.json'), 'utf8'))));
});

test('sign-firefox picks the signed file of this version, not the newest', () => {
    const script = readFileSync('scripts/sign-firefox.sh', 'utf8');
    assert.doesNotMatch(script, /ls -1t/);
    assert.match(script, /web-ext-artifacts\/\*-"\$VERSION"\.xpi/);
});

test('manifest declares the icons', () => {
    const m = JSON.parse(readFileSync('chrome-extension/manifest.json', 'utf8'));
    assert.deepEqual(m.icons, {16: 'icons/icon-16.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png'});
    for (const f of Object.values(m.icons))
        assert.ok(existsSync(join('chrome-extension', f)), f);
});

test('prepare-site substitutes the url and writes updates.json', () => {
    const out = mkdtempSync(join(tmpdir(), 'dwl-site-'));
    mkdirSync(join(out, 'public'), {recursive: true});
    const release = {...RELEASE, siteUrl: 'https://dwl.test', version: '9.9.9'};
    prepareSite(out, release);
    const install = readFileSync(join(out, 'public/install.sh'), 'utf8');
    assert.match(install, /SITE_URL="\$\{DWL_SITE_URL:-https:\/\/dwl\.test\}"/);
    assert.match(install, /VERSION="\$\{DWL_VERSION:-9\.9\.9\}"/);
    assert.doesNotMatch(install, /@@/);
    for (const script of ['install.sh', 'uninstall.sh']) {
        const body = readFileSync(join(out, 'public', script), 'utf8');
        for (const [name, value] of [['UUID', release.uuid], ['REPO', release.repo], ['CHROME_ID', release.chromeExtensionId],
            ['GECKO_ID', release.geckoId], ['HOST_NAME', release.hostName]])
            assert.ok(body.includes(`${name}="\${DWL_${name}:-${value}}"`), `${script} ${name}`);
    }
    assert.ok(existsSync(join(out, 'public/uninstall.sh')));
    assert.ok(existsSync(join(out, 'public/policies.py')));
    assert.deepEqual(JSON.parse(readFileSync(join(out, 'public/updates.json'), 'utf8')), {addons: {
        'deep-work-lock@deepwork.local': {updates: [{version: '9.9.9', update_link: 'https://dwl.test/releases/deep-work-lock-9.9.9.xpi'}]}}});
    assert.deepEqual(JSON.parse(readFileSync(join(out, 'release.json'), 'utf8')), release);
});

test('the committed site files are up to date', () => {
    const out = mkdtempSync(join(tmpdir(), 'dwl-site-'));
    mkdirSync(join(out, 'public'), {recursive: true});
    const writtenFiles = prepareSite(out);
    assert.deepEqual(writtenFiles.map(f => f.slice(out.length + 1)).sort(), [
        'public/install.sh', 'public/policies.py', 'public/uninstall.sh', 'public/updates.json', 'release.json']);
    for (const written of writtenFiles) {
        const rel = written.slice(out.length + 1);
        assert.equal(readFileSync(join('site', rel), 'utf8'), readFileSync(written, 'utf8'), `${rel} is stale: run npm run prepare-site`);
    }
});

test('the raw install.sh refuses to run, the prepared copy does not', () => {
    const bin = mkdtempSync(join(tmpdir(), 'dwl-bin-'));
    for (const tool of ['id', 'mktemp', 'rm', 'mkdir', 'dirname', 'basename', 'cat'])
        symlinkSync(execFileSync('which', [tool], {encoding: 'utf8'}).trim(), join(bin, tool));
    const env = {PATH: bin, HOME: bin};
    const BASH = execFileSync('which', ['bash'], {encoding: 'utf8'}).trim();
    const refusal = /not prepared for publishing/;
    const raw = spawnSync(BASH, ['scripts/install.sh'], {env, encoding: 'utf8'});
    assert.notEqual(raw.status, 0);
    assert.match(raw.stdout + raw.stderr, refusal);
    const out = mkdtempSync(join(tmpdir(), 'dwl-site-'));
    mkdirSync(join(out, 'public'), {recursive: true});
    prepareSite(out, {...RELEASE, siteUrl: 'https://dwl.test', version: '9.9.9'});
    const prepared = spawnSync(BASH, [join(out, 'public/install.sh')], {env, encoding: 'utf8'});
    assert.doesNotMatch(prepared.stdout + prepared.stderr, refusal);
});
