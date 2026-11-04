# extensions.gnome.org listing

Upload: `build/gnome/deep-work-lock@helmo21.github.io.shell-extension.zip`

## Name

Deep Work Lock

## Description

Lock your desktop on one window, one application or one Chrome or Firefox tab for a chosen duration. Pick a time and a target from the top bar menu; until the timer ends, the rest of the desktop is greyed out and inert (Alt+Tab, Super, overview, hot corner, workspaces and launch shortcuts are disabled, other windows are minimised, notifications are muted). There is no stop button. Browser tabs are locked through the companion Chrome and Firefox extensions.

Supports GNOME Shell 46 to 49 on X11 and Wayland. Source: https://github.com/Helmo21/deep-work-lock

## Review notes

### Why `unlock-dialog` is in `session-modes`

The lock must survive the lock screen: the countdown keeps running and the desktop stays locked when the user comes back. Without `unlock-dialog` the extension would be disabled when the screen locks and the session could be bypassed by locking and unlocking.

### Why the extension bundles a Python script

The extension ships a Python native-messaging host (`native-host/`), the only way for a browser extension to talk to the desktop. The source is included and is not minified or compiled. On enable, the extension writes (or refreshes) the Chrome and Firefox native-messaging manifests, which point at the script bundled inside the extension's own folder; nothing is copied elsewhere. Disabling the extension touches nothing, so that a temporary disable does not break the next enable. The manifests are removed by the uninstall script. The host does not run with extra privileges.

### Snap Firefox permission grant

When Firefox is installed as a snap, the sandbox asks a desktop portal before letting an extension start the host. On enable, the extension therefore pre-grants that permission in the user's PermissionStore: table `webextensions`, id `org.deepworklock.host`, app `snap.firefox`, value `["yes"]`. This is done because the portal dialog may not appear, and an unanswered request is stored as a refusal. It concerns only this host name.

## Screenshot to provide

One screenshot of the top bar menu open with the duration and target choices, and ideally one of the locked state with the orange countdown.
