#!/usr/bin/env node
// Builds the Chrome Web Store zip from chrome-extension/.
// Usage: node scripts/build-chrome.mjs [outDir]   (default: build)
import {copyFileSync, cpSync, mkdirSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RELEASE} from './release-config.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function buildChrome(outDir) {
    const source = join(root, 'chrome-extension');
    const dir = join(outDir, 'chrome');
    const zip = join(outDir, `deep-work-lock-chrome-${RELEASE.version}.zip`);
    rmSync(dir, {recursive: true, force: true});
    rmSync(zip, {force: true});
    mkdirSync(dir, {recursive: true});
    for (const file of ['manifest.json', 'background.js', 'lock.js'])
        copyFileSync(join(source, file), join(dir, file));
    cpSync(join(source, 'icons'), join(dir, 'icons'), {recursive: true});
    execFileSync('zip', ['-r', '-q', '-X', zip, '.'], {cwd: dir});
    return {dir, zip};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const {dir, zip} = buildChrome(resolve(process.argv[2] ?? join(root, 'build')));
    console.log(dir);
    console.log(zip);
}
