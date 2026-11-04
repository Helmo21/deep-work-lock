// Pure data: no gi:// imports, so Node tests can load it.
import {CHROME_EXTENSION_ID, GECKO_ID, HOST_NAME} from './constants.js';

export function hostPathFor(extensionPath) {
    return `${extensionPath}/native-host/deep_work_lock_host.py`;
}

export function nativeHostManifests(hostPath) {
    return [
        {
            relativePath: `.config/google-chrome/NativeMessagingHosts/${HOST_NAME}.json`,
            content: {
                name: HOST_NAME,
                description: 'Deep Work Lock bridge between Chrome and GNOME Shell',
                path: hostPath,
                type: 'stdio',
                allowed_origins: [`chrome-extension://${CHROME_EXTENSION_ID}/`],
            },
        },
        {
            relativePath: `.mozilla/native-messaging-hosts/${HOST_NAME}.json`,
            content: {
                name: HOST_NAME,
                description: 'Deep Work Lock bridge between Firefox and GNOME Shell',
                path: hostPath,
                type: 'stdio',
                allowed_extensions: [GECKO_ID],
            },
        },
    ];
}
