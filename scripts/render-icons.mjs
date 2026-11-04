#!/usr/bin/env node
// Renders assets/icon.svg to the committed PNGs. Run manually after editing
// the SVG (needs the sharp devDependency); the build itself never needs it.
import {mkdirSync, readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'assets', 'icon.svg'));
const outDir = join(root, 'chrome-extension', 'icons');
mkdirSync(outDir, {recursive: true});
for (const size of [16, 48, 128]) {
    await sharp(svg, {density: 72 * 8}).resize(size, size).png().toFile(join(outDir, `icon-${size}.png`));
    console.log(`icon-${size}.png`);
}
