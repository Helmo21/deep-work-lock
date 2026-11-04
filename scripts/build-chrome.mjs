#!/usr/bin/env node
// Builds the Chrome Web Store zip from chrome-extension/.
// Usage: node scripts/build-chrome.mjs [--store] [outDir]   (default: build)
// The manifest keeps its `key` by default, so an unpacked dev build has the
// same id as the store one. --store (or DWL_CHROME_STORE=1) drops `key` from
// the zipped manifest, for when the Chrome Web Store refuses an upload that
// carries one (see docs/release.md).
import {copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RELEASE} from './release-config.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function buildChrome(outDir, {store = false} = {}) {
    const source = join(root, 'chrome-extension');
    const dir = join(outDir, 'chrome');
    const zip = join(outDir, `deep-work-lock-chrome-${RELEASE.version}.zip`);
    rmSync(dir, {recursive: true, force: true});
    rmSync(zip, {force: true});
    mkdirSync(dir, {recursive: true});
    for (const file of ['background.js', 'lock.js'])
        copyFileSync(join(source, file), join(dir, file));
    if (store) {
        const {key: _key, ...manifest} = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8'));
        writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    } else {
        copyFileSync(join(source, 'manifest.json'), join(dir, 'manifest.json'));
    }
    cpSync(join(source, 'icons'), join(dir, 'icons'), {recursive: true});
    execFileSync('zip', ['-r', '-q', '-X', zip, '.'], {cwd: dir});
    return {dir, zip};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const store = args.includes('--store') || process.env.DWL_CHROME_STORE === '1';
    const outDir = args.find(a => a !== '--store');
    const {dir, zip} = buildChrome(resolve(outDir ?? join(root, 'build')), {store});
    console.log(dir);
    console.log(zip);
}
