#!/usr/bin/env node
// Builds the GNOME Shell extension zip submitted to extensions.gnome.org.
// Usage: node scripts/build-gnome.mjs [outDir]   (default: build/gnome)
import {chmodSync, copyFileSync, cpSync, mkdirSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RELEASE, extensionDir} from './release-config.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function buildGnome(outDir) {
    const dir = join(outDir, RELEASE.uuid);
    const zip = join(outDir, `${RELEASE.uuid}.shell-extension.zip`);
    rmSync(dir, {recursive: true, force: true});
    rmSync(zip, {force: true});
    mkdirSync(dir, {recursive: true});
    cpSync(extensionDir(root), dir, {
        recursive: true,
        filter: src => !src.split('/').includes('__pycache__'),
    });
    // Only the host script ships: not its tests, not its bytecode.
    mkdirSync(join(dir, 'native-host'), {recursive: true});
    const host = join(dir, 'native-host', 'deep_work_lock_host.py');
    copyFileSync(join(root, 'native-host', 'deep_work_lock_host.py'), host);
    chmodSync(host, 0o755);
    copyFileSync(join(root, 'LICENSE'), join(dir, 'LICENSE'));
    // Contents sit at the zip root, as extensions.gnome.org requires.
    execFileSync('zip', ['-r', '-q', '-X', zip, '.'], {cwd: dir});
    return {dir, zip};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const {dir, zip} = buildGnome(resolve(process.argv[2] ?? join(root, 'build', 'gnome')));
    console.log(dir);
    console.log(zip);
}
