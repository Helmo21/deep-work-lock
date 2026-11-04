# Chrome Web Store listing

Upload: `build/deep-work-lock-chrome-<version>.zip`

## Name

Deep Work Lock

## Summary (132 characters max)

Locks one browser tab during a Deep Work Lock session started from the GNOME extension.

## Description

Deep Work Lock is the browser half of a focus lock for GNOME. It does nothing on its own: it needs the Deep Work Lock GNOME Shell extension, installed with the one-line command from the project website.

When you start a session on a Chrome tab, this extension keeps you on it until the timer runs out. New tabs and windows are closed, you are returned to the locked tab, internal pages (chrome://) are blocked, and navigation stays on the tab's site and its subdomains (sign-in pages of Google, Microsoft and Apple excepted).

It talks only to the Deep Work Lock native host on your own machine. Nothing is sent to any server. Open source, GPL-3.0-or-later.

## Category

Productivity

## Single purpose statement

Keep the browser on one chosen tab for the duration of a focus session started from the Deep Work Lock desktop extension.

## Permission justifications

- `tabs`: read the URL and id of tabs to find the locked tab, close new tabs, and switch back to the locked tab.
- `nativeMessaging`: talk to the local Deep Work Lock native host (`org.deepworklock.host`), which relays the session state from the GNOME extension. No data leaves the machine.
- `declarativeNetRequest`: during a session, block main-frame requests of the locked tab (and its popups) that leave the locked site, so the restriction holds before the page loads.
- `webNavigation`: detect top-level navigations before they commit, so the tab can be reverted to the locked page.
- `storage`: keep the session state in `chrome.storage.session` so the lock survives the service worker being suspended. Cleared when the browser closes.
- Host permission `<all_urls>`: the locked site is chosen by the user at run time and can be any site, so the extension must be able to act on any URL. It reads no page content and injects no script.

## Privacy policy URL

`${siteUrl}/privacy` (with `siteUrl` from `release.json`)

## Visibility

Unlisted

## Screenshots to provide

At least one at 1280x800 (or 640x400): a locked tab, and the GNOME menu choosing a tab.
