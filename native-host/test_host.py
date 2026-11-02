import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))

from deep_work_lock_host import (  # noqa: E402
    BRIDGES, FrameReader, PendingRequests, bridge_xml, detect_browser, encode_message,
    expect_window_detail, legacy_expect_method,
)


class FramingTest(unittest.TestCase):
    def test_round_trip(self):
        reader = FrameReader()
        self.assertEqual(reader.feed(encode_message({"a": "é"})), [{"a": "é"}])

    def test_partial_chunks(self):
        data = encode_message({"type": "hello"})
        reader = FrameReader()
        self.assertEqual(reader.feed(data[:3]), [])
        self.assertEqual(reader.feed(data[3:7]), [])
        self.assertEqual(reader.feed(data[7:]), [{"type": "hello"}])

    def test_two_messages_in_one_chunk(self):
        reader = FrameReader()
        data = encode_message({"n": 1}) + encode_message({"n": 2})
        self.assertEqual(reader.feed(data), [{"n": 1}, {"n": 2}])


class PendingRequestsTest(unittest.TestCase):
    def test_resolve(self):
        pending = PendingRequests(timeout=3.0)
        rid = pending.add("inv", now=0.0)
        self.assertIsNone(pending.resolve(rid + 100))
        self.assertEqual(pending.resolve(rid), "inv")
        self.assertIsNone(pending.resolve(rid))

    def test_ids_are_unique(self):
        pending = PendingRequests(timeout=3.0)
        self.assertNotEqual(pending.add("a", now=0.0), pending.add("b", now=0.0))

    def test_expire(self):
        pending = PendingRequests(timeout=3.0)
        pending.add("old", now=0.0)
        pending.add("new", now=2.0)
        self.assertEqual(pending.expire(now=3.5), ["old"])
        self.assertEqual(pending.expire(now=10.0), ["new"])


class DetectBrowserTest(unittest.TestCase):
    def test_chrome(self):
        self.assertEqual(detect_browser(["h", "chrome-extension://abc/"]), "chrome")

    def test_firefox(self):
        self.assertEqual(detect_browser([
            "h", "/home/u/.mozilla/native-messaging-hosts/org.deepworklock.host.json",
            "deep-work-lock@deepwork.local"]), "firefox")

    def test_unknown_defaults_to_chrome(self):
        self.assertEqual(detect_browser(["h"]), "chrome")


class BridgeTest(unittest.TestCase):
    def test_names(self):
        self.assertEqual(BRIDGES["firefox"],
                         ("org.deepworklock.FirefoxBridge", "/org/deepworklock/FirefoxBridge"))
        self.assertEqual(BRIDGES["chrome"],
                         ("org.deepworklock.ChromeBridge", "/org/deepworklock/ChromeBridge"))

    def test_xml_uses_name(self):
        xml = bridge_xml("org.deepworklock.FirefoxBridge")
        self.assertIn('interface name="org.deepworklock.FirefoxBridge"', xml)
        for method in ("ListWindows", "Lock", "Unlock"):
            self.assertIn(f'name="{method}"', xml)

    def test_expect_detail(self):
        self.assertEqual(
            expect_window_detail("firefox", {"type": "expectWindow", "reason": "relocated",
                                             "bounds": {"left": 1}}),
            {"browser": "firefox", "reason": "relocated", "bounds": {"left": 1}, "title": None})
        self.assertEqual(expect_window_detail("chrome", {}),
                         {"browser": "chrome", "reason": "popup", "bounds": None, "title": None})


    def test_expect_detail_title(self):
        self.assertEqual(expect_window_detail("firefox", {"title": "Docs"})["title"], "Docs")
        self.assertIsNone(expect_window_detail("firefox", {})["title"])

    def test_legacy_fallback(self):
        unknown = "GDBus.Error:org.freedesktop.DBus.Error.UnknownMethod: No such method 'ExpectWindow'"
        self.assertEqual(legacy_expect_method("chrome", unknown), "ExpectChromeWindow")
        self.assertIsNone(legacy_expect_method("firefox", unknown))
        self.assertIsNone(legacy_expect_method("chrome", "Timeout was reached"))


if __name__ == "__main__":
    unittest.main()
