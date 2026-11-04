#!/usr/bin/env python3
"""Write, merge and remove the Chrome and Firefox enterprise policies that
force-install the Deep Work Lock browser extension in normal_installed mode.

Run as root by install.sh / uninstall.sh, with --etc pointing at the real /etc
(or at a temporary directory in tests). Nothing here touches the network.
"""

import argparse
import copy
import json
import os
import sys
import tempfile

CHROME_UPDATE_URL = "https://clients2.google.com/service/update2/crx"
CHROME_RELATIVE = os.path.join("opt", "chrome", "policies", "managed", "deep-work-lock.json")
FIREFOX_RELATIVE = os.path.join("firefox", "policies", "policies.json")


class PolicyFileError(Exception):
    """An existing policies.json cannot be read as a JSON object."""


def chrome_policy(extension_id):
    return {"ExtensionSettings": {extension_id: {
        "installation_mode": "normal_installed",
        "update_url": CHROME_UPDATE_URL,
    }}}


def firefox_entry(install_url):
    return {"installation_mode": "normal_installed", "install_url": install_url}


def merge_firefox(existing, gecko_id, install_url):
    doc = copy.deepcopy(existing) if existing is not None else {}
    policies = doc.setdefault("policies", {})
    settings = policies.setdefault("ExtensionSettings", {})
    settings[gecko_id] = firefox_entry(install_url)
    return doc


def _has_firefox_entry(doc, gecko_id):
    if not isinstance(doc, dict):
        return False
    policies = doc.get("policies")
    if not isinstance(policies, dict):
        return False
    settings = policies.get("ExtensionSettings")
    return isinstance(settings, dict) and gecko_id in settings


def remove_firefox(existing, gecko_id):
    if existing is None:
        return None
    doc = copy.deepcopy(existing)
    policies = doc.get("policies")
    if isinstance(policies, dict):
        settings = policies.get("ExtensionSettings")
        if isinstance(settings, dict):
            settings.pop(gecko_id, None)
            if not settings:
                del policies["ExtensionSettings"]
        if not policies:
            del doc["policies"]
    return doc or None


def _read_policies_file(path):
    """Return the parsed object, None if absent, or raise PolicyFileError."""
    if not os.path.exists(path):
        return None
    try:
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)
    except (OSError, ValueError) as exc:
        raise PolicyFileError(f"cannot read {path}: {exc}") from exc
    if not isinstance(doc, dict):
        raise PolicyFileError(f"{path} does not contain a JSON object")
    return doc


def _make_dirs(path):
    """Create missing directories with mode 0o755, independent of the umask."""
    missing = []
    current = path
    while current and not os.path.isdir(current):
        missing.append(current)
        parent = os.path.dirname(current)
        if parent == current:
            break
        current = parent
    for directory in reversed(missing):
        os.mkdir(directory, 0o755)
        os.chmod(directory, 0o755)


def _write_json_atomic(path, doc):
    directory = os.path.dirname(path)
    _make_dirs(directory)
    fd, tmp = tempfile.mkstemp(dir=directory, prefix=".deep-work-lock-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(doc, f, indent=2)
            f.write("\n")
            f.flush()
            os.fsync(f.fileno())
        os.chmod(tmp, 0o644)
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def _targets(args):
    chrome_path = os.path.join(args.etc, CHROME_RELATIVE)
    firefox_path = os.path.join(args.etc, FIREFOX_RELATIVE)
    return chrome_path, firefox_path


def cmd_install(args):
    chrome_path, firefox_path = _targets(args)
    # Read and validate everything before writing anything, so a refusal
    # leaves every file untouched.
    firefox_doc = None
    if args.firefox:
        try:
            existing = _read_policies_file(firefox_path)
        except PolicyFileError as exc:
            sys.stderr.write(f"policies.py: error: {exc}; refusing to overwrite it\n")
            return 1
        firefox_doc = merge_firefox(existing, args.gecko_id, args.install_url)

    if args.chrome:
        _write_json_atomic(chrome_path, chrome_policy(args.chrome_id))
        print(f"Wrote {chrome_path}")
    if args.firefox:
        _write_json_atomic(firefox_path, firefox_doc)
        print(f"Wrote {firefox_path}")
    return 0


def cmd_remove(args):
    chrome_path, firefox_path = _targets(args)
    if args.firefox:
        try:
            existing = _read_policies_file(firefox_path)
        except PolicyFileError as exc:
            sys.stderr.write(f"policies.py: error: {exc}; leaving it untouched\n")
            return 1
        if existing is not None and _has_firefox_entry(existing, args.gecko_id):
            remaining = remove_firefox(existing, args.gecko_id)
            if remaining is None:
                os.remove(firefox_path)
                print(f"Removed {firefox_path}")
            else:
                _write_json_atomic(firefox_path, remaining)
                print(f"Wrote {firefox_path}")

    if args.chrome and os.path.exists(chrome_path):
        os.remove(chrome_path)
        print(f"Removed {chrome_path}")
    return 0


def build_parser():
    parser = argparse.ArgumentParser(description="Manage Deep Work Lock browser policies.")
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("install", "remove"):
        p = sub.add_parser(name)
        p.add_argument("--etc", required=True, help="root of the configuration tree (usually /etc)")
        p.add_argument("--chrome-id", required=True)
        p.add_argument("--gecko-id", required=True)
        if name == "install":
            p.add_argument("--install-url", required=True)
        p.add_argument("--chrome", action="store_true", help="handle the Chrome policy")
        p.add_argument("--firefox", action="store_true", help="handle the Firefox policy")
        p.set_defaults(func=cmd_install if name == "install" else cmd_remove)
    return parser


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    if not (args.chrome or args.firefox):
        parser.error("choose --chrome and/or --firefox")
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
