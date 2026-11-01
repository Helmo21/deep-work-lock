import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))

from deep_work_lock_host import FrameReader, PendingRequests, encode_message  # noqa: E402


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


if __name__ == "__main__":
    unittest.main()
