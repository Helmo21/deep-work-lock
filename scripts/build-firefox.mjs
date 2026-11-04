#!/usr/bin/env node
// Builds the Firefox extension from chrome-extension/: same code, a manifest
// Firefox accepts. Usage: node scripts/build-firefox.mjs [outDir]

import {cpSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RELEASE} from './release-config.mjs';

// Signing ties this id to the Mozilla account for good: never change it.
export const GECKO_ID = RELEASE.geckoId;
const SHARED_FILES = ['background.js', 'lock.js', 'icons'];

export function firefoxManifest(chromeManifest, siteUrl = RELEASE.siteUrl) {
    const {key, minimum_chrome_version, background, ...rest} = chromeManifest;
    return {
        ...rest,
        // Firefox has no extension service worker: an event page instead.
        background: {scripts: [background.service_worker], type: 'module'},
        browser_specific_settings: {
            gecko: {
                id: GECKO_ID,
                strict_min_version: '140.0',
                data_collection_permissions: {required: ['none']},
                update_url: `${siteUrl}/updates.json`,
            },
        },
    };
}

function build(outDir) {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const source = join(root, 'chrome-extension');
    const chrome = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8'));
    rmSync(outDir, {recursive: true, force: true});
    mkdirSync(outDir, {recursive: true});
    writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(firefoxManifest(chrome), null, 2)}\n`);
    for (const file of SHARED_FILES)
        cpSync(join(source, file), join(outDir, file), {recursive: true});
    return outDir;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    console.log(build(resolve(process.argv[2] ?? join(root, 'build', 'firefox'))));
}
