// Generates the files the website serves from the repo sources.
import {copyFileSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RELEASE} from './release-config.mjs';

const SCRIPTS = fileURLToPath(new URL('.', import.meta.url));

function substitute(text, release) {
    return text
        .replaceAll('@@SITE_URL@@', release.siteUrl)
        .replaceAll('@@VERSION@@', release.version)
        .replaceAll('@@UUID@@', release.uuid)
        .replaceAll('@@REPO@@', release.repo)
        .replaceAll('@@CHROME_ID@@', release.chromeExtensionId)
        .replaceAll('@@GECKO_ID@@', release.geckoId)
        .replaceAll('@@HOST_NAME@@', release.hostName);
}

// Returns the list of files written under siteDir.
export function prepareSite(siteDir, release = RELEASE) {
    const pub = join(siteDir, 'public');
    mkdirSync(pub, {recursive: true});
    const written = [];
    const put = (path, content) => {
        if (content.includes('@@'))
            throw new Error(`${path} still contains an unsubstituted @@ placeholder`);
        writeFileSync(path, content);
        written.push(path);
    };

    put(join(siteDir, 'release.json'), `${JSON.stringify(release, null, 2)}\n`);
    for (const name of ['install.sh', 'uninstall.sh'])
        put(join(pub, name), substitute(readFileSync(join(SCRIPTS, name), 'utf8'), release));
    const policies = join(pub, 'policies.py');
    copyFileSync(join(SCRIPTS, 'policies.py'), policies);
    put(policies, readFileSync(policies, 'utf8'));
    put(join(pub, 'updates.json'), `${JSON.stringify({addons: {[release.geckoId]: {updates: [{
        version: release.version,
        update_link: `${release.siteUrl}/releases/deep-work-lock-${release.version}.xpi`,
    }]}}}, null, 2)}\n`);
    return written;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const siteDir = resolve(process.argv[2] ?? 'site');
    for (const path of prepareSite(siteDir))
        console.log(`wrote ${path}`);
}
