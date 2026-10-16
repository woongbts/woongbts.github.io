"""Offline safeguards for the daily Zeronote subsidy import."""
import unittest
from urllib.error import HTTPError
from datetime import date
from daily_wireless_sync import verified_primary_or_official_support, valid_public_support, ROOT, select_current_devices, valid_device_price


class DailyWirelessSyncTests(unittest.TestCase):
    def test_approved_duo_preorders_work_for_all_carriers_only_from_start_date(self):
        for carrier, code in [('SKT', 'A3720-2TB'), ('KT', 'AIPD-2T'), ('LGU+', 'UIPD-2T')]:
            device = self.source_device()
            device.update(device_name=code, release_dt='2026-10-23', factory_price='5,093,000')
            self.assertEqual(select_current_devices([device], carrier, date(2026, 10, 15))[0], [])
            self.assertEqual(select_current_devices([device], carrier, date(2026, 10, 16)), ([(1, device)], []))
            device['release_dt'] = '2026-11-23'
            self.assertEqual(select_current_devices([device], carrier, date(2026, 10, 16))[0], [])

    def test_duo_price_exception_does_not_relax_other_model_checks(self):
        self.assertTrue(valid_device_price(5093000, 'A3720-2TB'))
        self.assertFalse(valid_device_price(5093000, 'UNAPPROVED'))
        self.assertFalse(valid_device_price(6000001, 'A3720-2TB'))
        self.assertFalse(valid_device_price(-1, 'A3720-2TB'))
        self.assertFalse(valid_device_price(None, 'A3720-2TB'))

    def source_device(self, **changes):
        return dict(device_idx="3062", model_name="Source phone", device_name="MODEL",
                    release_dt="2026-10-15", factory_price="1,000,000", **changes)

    def test_future_expensive_model_does_not_block_released_models(self):
        future = self.source_device()
        future.update(release_dt="2026-10-23", factory_price="5,093,000")
        current = self.source_device()
        candidates, deferred = select_current_devices([future, current], "SKT", date(2026, 10, 15))
        self.assertEqual(candidates, [(2, current)])
        self.assertEqual(deferred[0]["reason"], "not_released_yet")
        self.assertEqual(deferred[0]["retail_price"], 5093000)

    def test_release_day_is_reconsidered_automatically(self):
        device = self.source_device()
        device["release_dt"] = "2026-10-23"
        self.assertEqual(select_current_devices([device], "KT", date(2026, 10, 22))[0], [])
        self.assertEqual(select_current_devices([device], "KT", date(2026, 10, 23)), ([(1, device)], []))

    def test_invalid_current_price_is_deferred_without_fabricating_a_price(self):
        for bad_price in ("5,093,000", "", "-1", "0"):
            device = self.source_device()
            device["factory_price"] = bad_price
            candidates, deferred = select_current_devices([device], "SKT", date(2026, 10, 15))
            self.assertEqual(candidates, [])
            self.assertEqual(deferred[0]["reason"], "retail_price_out_of_range")
            self.assertEqual(device["factory_price"], bad_price)

    def test_invalid_date_is_deferred_but_old_stock_is_not_reintroduced(self):
        invalid, old = self.source_device(), self.source_device()
        invalid["release_dt"], old["release_dt"] = "2026-99-99", "2020-01-01"
        candidates, deferred = select_current_devices([invalid, old], "LGU+", date(2026, 10, 15))
        self.assertEqual(candidates, [])
        self.assertEqual(len(deferred), 1)
        self.assertEqual(deferred[0]["reason"], "invalid_release_date")

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
