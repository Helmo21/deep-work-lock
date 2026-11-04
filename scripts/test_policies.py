# scripts/test_policies.py
import json, os, subprocess, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(__file__))
import policies

URL = "https://example.invalid/releases/deep-work-lock-latest.xpi"

class PureTest(unittest.TestCase):
    def test_chrome_policy(self):
        self.assertEqual(policies.chrome_policy("abc"), {"ExtensionSettings": {"abc": {
            "installation_mode": "normal_installed",
            "update_url": "https://clients2.google.com/service/update2/crx"}}})

    def test_merge_keeps_other_policies(self):
        existing = {"policies": {"DisableTelemetry": True,
                                 "ExtensionSettings": {"other@x": {"installation_mode": "blocked"}}}}
        merged = policies.merge_firefox(existing, "g@x", URL)
        self.assertTrue(merged["policies"]["DisableTelemetry"])
        self.assertEqual(merged["policies"]["ExtensionSettings"]["other@x"], {"installation_mode": "blocked"})
        self.assertEqual(merged["policies"]["ExtensionSettings"]["g@x"],
                         {"installation_mode": "normal_installed", "install_url": URL})
        self.assertIsNot(merged, existing)

    def test_merge_from_nothing_and_idempotent(self):
        once = policies.merge_firefox(None, "g@x", URL)
        self.assertEqual(policies.merge_firefox(once, "g@x", URL), once)

    def test_remove(self):
        only_ours = policies.merge_firefox(None, "g@x", URL)
        self.assertIsNone(policies.remove_firefox(only_ours, "g@x"))
        shared = policies.merge_firefox({"policies": {"DisableTelemetry": True}}, "g@x", URL)
        self.assertEqual(policies.remove_firefox(shared, "g@x"), {"policies": {"DisableTelemetry": True}})
        self.assertIsNone(policies.remove_firefox(None, "g@x"))

class CliTest(unittest.TestCase):
    def run_cli(self, *args):
        return subprocess.run([sys.executable, policies.__file__, *args], capture_output=True, text=True)

    def test_install_then_remove(self):
        with tempfile.TemporaryDirectory() as etc:
            r = self.run_cli("install", "--etc", etc, "--chrome-id", "abc", "--gecko-id", "g@x",
                             "--install-url", URL, "--chrome", "--firefox")
            self.assertEqual(r.returncode, 0, r.stderr)
            chrome = os.path.join(etc, "opt/chrome/policies/managed/deep-work-lock.json")
            firefox = os.path.join(etc, "firefox/policies/policies.json")
            self.assertEqual(json.load(open(chrome)), policies.chrome_policy("abc"))
            self.assertIn("g@x", json.load(open(firefox))["policies"]["ExtensionSettings"])
            self.assertEqual(oct(os.stat(chrome).st_mode & 0o777), "0o644")
            r = self.run_cli("remove", "--etc", etc, "--chrome-id", "abc", "--gecko-id", "g@x", "--chrome", "--firefox")
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertFalse(os.path.exists(chrome))
            self.assertFalse(os.path.exists(firefox))

    def test_only_firefox(self):
        with tempfile.TemporaryDirectory() as etc:
            self.run_cli("install", "--etc", etc, "--chrome-id", "abc", "--gecko-id", "g@x",
                         "--install-url", URL, "--firefox")
            self.assertFalse(os.path.exists(os.path.join(etc, "opt/chrome")))
            self.assertTrue(os.path.exists(os.path.join(etc, "firefox/policies/policies.json")))

    def test_refuses_unreadable_policies_json(self):
        with tempfile.TemporaryDirectory() as etc:
            os.makedirs(os.path.join(etc, "firefox/policies"))
            with open(os.path.join(etc, "firefox/policies/policies.json"), "w") as f:
                f.write("not json")
            r = self.run_cli("install", "--etc", etc, "--chrome-id", "abc", "--gecko-id", "g@x",
                             "--install-url", URL, "--firefox")
            self.assertEqual(r.returncode, 1)
            self.assertEqual(open(os.path.join(etc, "firefox/policies/policies.json")).read(), "not json")

if __name__ == "__main__":
    unittest.main()
