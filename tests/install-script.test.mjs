import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, chmodSync, mkdirSync, readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

function sandbox({gdbusResult = "('successful',)", state = 1, chrome = true, firefox = true} = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'dwl-install-'));
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    const fake = (name, body) => { writeFileSync(join(bin, name), `#!/bin/bash\n${body}\n`); chmodSync(join(bin, name), 0o755); };
    fake('gdbus', `case "$*" in *InstallRemoteExtension*) echo "${gdbusResult}";; *GetExtensionInfo*) echo "({'state': <${state}.0>, 'uuid': <'x'>},)";; *) echo "()";; esac`);
    fake('gnome-shell', 'echo "GNOME Shell 46.0"');
    fake('sudo', 'echo "+ sudo $*"');
    if (chrome) fake('google-chrome', 'true');
    if (firefox) fake('firefox', 'true');
    mkdirSync(join(dir, 'home/.config/google-chrome/NativeMessagingHosts'), {recursive: true});
    writeFileSync(join(dir, 'home/.config/google-chrome/NativeMessagingHosts/org.deepworklock.host.json'), '{}');
    // This machine has real browsers: point detection at the fake bin only.
    return {dir, env: {...process.env, PATH: `${bin}:${process.env.PATH}`, DWL_HOME: join(dir, 'home'), DWL_ETC: join(dir, 'etc'),
        DWL_SITE_URL: 'https://dwl.test', DWL_VERSION: '0.2.0', DWL_DRY_RUN: '1', DWL_POLICIES_PY: 'scripts/policies.py',
        DWL_CHROME_CANDIDATES: chrome ? join(bin, 'google-chrome') : '',
        DWL_FIREFOX_CANDIDATES: firefox ? join(bin, 'firefox') : ''}};
}

const run = (env, script = 'scripts/install.sh') => spawnSync('bash', [script], {env, encoding: 'utf8'});

test('happy path: e.g.o install, both browsers, no logout needed', () => {
    const {env} = sandbox();
    const r = run(env);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Installing the GNOME extension from extensions\.gnome\.org/);
    assert.match(r.stdout, /\+ sudo .*policies\.py install .*--chrome .*--firefox|\+ sudo .*policies\.py install .*--firefox .*--chrome/);
    assert.match(r.stdout, /--install-url https:\/\/dwl\.test\/releases\/deep-work-lock-latest\.xpi/);
    assert.match(r.stdout, /Click ◉ Focus in the top bar/);
    assert.doesNotMatch(r.stdout, /Log out/);
});

test('running twice gives the same output', () => {
    const {env} = sandbox();
    assert.equal(run(env).stdout, run(env).stdout);
});

test('only chrome installed: no firefox policy', () => {
    const {env} = sandbox({firefox: false});
    const out = run(env).stdout;
    assert.match(out, /policies\.py install .*--chrome/);
    assert.doesNotMatch(out, /--firefox/);
});

test('cancelled GNOME dialog stops before sudo', () => {
    const {env} = sandbox({gdbusResult: "('cancelled',)"});
    const r = run(env);
    assert.equal(r.status, 2);
    assert.match(r.stdout + r.stderr, /You cancelled the GNOME dialog/);
    assert.doesNotMatch(r.stdout, /sudo/);
});

test('e.g.o failure falls back to the release zip and asks to log out', () => {
    const {env} = sandbox({gdbusResult: 'Error: org.gnome.Shell.ExtensionError: not found'});
    const r = run({...env, DWL_CURL: 'echo', DWL_GNOME_EXTENSIONS: 'echo'});
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /releases\/download\/v0\.2\.0\/deep-work-lock@helmo21\.github\.io\.shell-extension\.zip/);
    assert.match(r.stdout, /Log out and back in to finish/);
});

test('no browser: refuses before touching anything', () => {
    const {env} = sandbox({chrome: false, firefox: false});
    const r = run(env);
    assert.equal(r.status, 1);
    assert.doesNotMatch(r.stdout, /InstallRemoteExtension|sudo/);
});

test('uninstall removes policies and the extension', () => {
    const {env} = sandbox();
    const r = run(env, 'scripts/uninstall.sh');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /\+ sudo .*policies\.py remove/);
    assert.match(r.stdout, /Deep Work Lock is uninstalled/);
});

// A gsettings that keeps org.gnome.shell keys as files in the sandbox.
function fakeGsettings(dir, values) {
    const store = join(dir, 'gsettings');
    mkdirSync(store);
    for (const [key, value] of Object.entries(values))
        writeFileSync(join(store, key), `${value}\n`);
    const path = join(dir, 'bin', 'gsettings');
    writeFileSync(path, `#!/bin/bash\ncase "$1" in get) cat "${store}/$3";; set) printf '%s\\n' "$4" > "${store}/$3";; esac\n`);
    chmodSync(path, 0o755);
    return key => readFileSync(join(store, key), 'utf8').trim();
}

const UUID = 'deep-work-lock@helmo21.github.io';

test('zip fallback enables the extension and lifts an earlier disable', () => {
    const {dir, env} = sandbox({gdbusResult: 'Error: org.gnome.Shell.ExtensionError: not found'});
    const read = fakeGsettings(dir, {
        'enabled-extensions': "['other@x']",
        'disabled-extensions': `['${UUID}', 'keep@x']`,
    });
    // Not a dry run: every command that changes something is a fake.
    const r = run({...env, DWL_DRY_RUN: '0', DWL_CURL: 'echo', DWL_GNOME_EXTENSIONS: 'echo',
        DWL_GSETTINGS: join(dir, 'bin', 'gsettings')});
    assert.equal(r.status, 0, r.stderr);
    assert.equal(read('enabled-extensions'), `['other@x', '${UUID}']`);
    assert.equal(read('disabled-extensions'), "['keep@x']");
    assert.match(r.stdout, /Log out and back in to finish/);
});

test('extension in ERROR after a hot-load fails without logout advice or sudo', () => {
    const {env} = sandbox({state: 3});
    const r = run(env);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /could not start it \(it reported an error/);
    assert.match(r.stderr, /github\.com\/Helmo21\/deep-work-lock\/issues/);
    assert.doesNotMatch(r.stdout + r.stderr, /Log out/);
    assert.doesNotMatch(r.stdout, /sudo/);
});

test('GNOME dialog left unanswered: stops, no fallback, no sudo', () => {
    const {env} = sandbox({gdbusResult: 'Error: Timeout was reached'});
    const r = run({...env, DWL_CURL: 'echo', DWL_GNOME_EXTENSIONS: 'echo'});
    assert.equal(r.status, 2);
    assert.match(r.stderr, /No answer from the GNOME dialog\. Run the command again\./);
    assert.doesNotMatch(r.stdout, /releases\/download|sudo/);
});

test('missing sudo is reported before anything changes', () => {
    const {dir, env} = sandbox();
    const r = run({...env, DWL_SUDO: join(dir, 'no-such-sudo')});
    assert.equal(r.status, 1);
    assert.match(r.stderr, /needs .*no-such-sudo/);
    assert.doesNotMatch(r.stdout, /Installing the GNOME extension/);
});

test('uninstall forgets the extension in enabled- and disabled-extensions', () => {
    const {dir, env} = sandbox();
    const read = fakeGsettings(dir, {
        'enabled-extensions': `['a@x', '${UUID}']`,
        'disabled-extensions': `['${UUID}']`,
    });
    const r = run({...env, DWL_DRY_RUN: '0', DWL_GNOME_EXTENSIONS: 'echo',
        DWL_GSETTINGS: join(dir, 'bin', 'gsettings')}, 'scripts/uninstall.sh');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(read('enabled-extensions'), "['a@x']");
    assert.equal(read('disabled-extensions'), '[]');
    assert.match(r.stdout, /Deep Work Lock is uninstalled/);
});
