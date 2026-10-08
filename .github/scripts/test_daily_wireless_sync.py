"""Offline safeguards for the daily Zeronote subsidy import."""
import unittest
from urllib.error import HTTPError
from daily_wireless_sync import verified_primary_or_official_support, valid_public_support, ROOT


class DailyWirelessSyncTests(unittest.TestCase):
    def test_zeronote_is_the_explicit_default(self):
        self.assertTrue(ROOT.startswith("https://"))

    def test_valid_primary_feed_is_authoritative_and_does_not_request_carrier(self):
        def do_not_call(*args):
            raise AssertionError("valid Zeronote amount must not call official source")
        self.assertEqual(
            verified_primary_or_official_support(
                "250,000원", 1254000, "LGU+", "SM-S900", "5G", 69000, "번호이동",
                official_lookup=do_not_call,
            ),
            (250000, False),
        )

    def test_zero_is_a_real_verified_number_not_missing(self):
        self.assertEqual(verified_primary_or_official_support(
            "0원", 1254000, "LGU+", "SM-S900", "5G", 69000, "기기변경",
        ), (0, False))

    def test_blank_amount_is_unknown_not_zero(self):
        self.assertEqual(verified_primary_or_official_support(
            None, 1254000, "LGU+", "SM-S900", "5G", 69000, "기기변경",
            official_lookup=lambda *_: self.fail("must not call official source"),
        ), (None, False))

    def test_successful_secondary_carrier_validation(self):
        self.assertEqual(
            verified_primary_or_official_support(
                "1,400,000", 1254000, "LGU+", "SM-S900", "5G", 69000, "기기변경",
                official_lookup=lambda *_: 350000,
            ), (350000, True),
        )

    def test_carrier_access_denied_does_not_create_false_subsidy(self):
        def blocked(*args):
            raise HTTPError("https://www.lguplus.com", 403, "Forbidden", {}, None)
        self.assertEqual(verified_primary_or_official_support(
            "1,400,000", 1254000, "LGU+", "SM-S900", "5G", 69000, "기기변경",
            official_lookup=blocked,
        ), (None, False))

    def test_carrier_verified_but_illogical_value_is_omitted(self):
        self.assertEqual(verified_primary_or_official_support(
            "1,400,000", 1254000, "LGU+", "SM-S900", "5G", 69000, "기기변경",
            official_lookup=lambda *_: 3000000,
        ), (None, False))

    def test_bad_primary_support_for_other_carriers_still_fails_closed(self):
        with self.assertRaisesRegex(RuntimeError, "invalid Zeronote subsidy"):
            verified_primary_or_official_support(
                "1,400,000", 1254000, "SKT", "SM-S900", "5G", 69000, "기기변경",
            )


if __name__ == "__main__":
    unittest.main()
