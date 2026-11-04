// Single source of truth for the release version and the public identifiers.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

export const RELEASE = JSON.parse(
    readFileSync(new URL('../release.json', import.meta.url), 'utf8'));

// Value shipped in release.json until the author provides the real domain.
export const PLACEHOLDER_SITE_URL = 'https://example.invalid';

// Chrome derives the extension id from the public key in the manifest:
// sha256 of the DER key, first 32 hex digits, each digit mapped to 'a'..'p'.
export function chromeExtensionIdOf(keyBase64) {
    const digest = createHash('sha256')
        .update(Buffer.from(keyBase64, 'base64'))
        .digest('hex')
        .slice(0, 32);
    return [...digest].map(c => String.fromCharCode('a'.charCodeAt(0) + parseInt(c, 16))).join('');
}

export function extensionDir(root) {
    return join(root, 'gnome-extension', RELEASE.uuid);
}
