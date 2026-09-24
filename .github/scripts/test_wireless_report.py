import copy
import unittest
from report_wireless_changes import build_report, flatten_supports


class ReportTests(unittest.TestCase):
    def setUp(self):
        self.catalog = {"devices": [{"id": "d", "name": "시험 단말", "carrier": "SKT"}]}
        self.plans = {"mobile_plans": [{"id": "p", "name": "시험 요금제"}]}
        self.supports = {"support_schedules": [{"carrier": "SKT", "device_ids": ["d"],
            "join_types": ["기기변경", "번호이동"], "amounts": {"p": 500000}}]}

    def report(self, new):
        return build_report(self.catalog, self.plans, self.supports,
                            self.catalog, self.plans, new)

    def test_join_type_change_is_not_reported_for_other_join(self):
        new = copy.deepcopy(self.supports)
        new["support_schedules"][0]["join_types"] = ["번호이동"]
        new["support_schedules"].append({"carrier": "SKT", "device_ids": ["d"],
            "join_types": ["기기변경"], "amounts": {"p": 600000}})
        text = self.report(new)
        self.assertIn("500,000원 → 600,000원", text)
        self.assertIn("공시지원금 1건", text)
        self.assertNotIn("| 번호이동 |", text)

    def test_date_only_change(self):
        new = copy.deepcopy(self.supports)
        new["meta"] = {"updated_at": "2099-01-01"}
        self.assertIn("공시지원금 변동 없음", self.report(new))

    def test_missing_and_zero_are_different(self):
        new = copy.deepcopy(self.supports)
        new["support_schedules"][0]["amounts"] = {"new": 0}
        text = self.report(new)
        self.assertIn("신규 등록 0원", text)
        self.assertIn("삭제 (기존 500,000원)", text)

    def test_conflicting_schedules_fail(self):
        new = copy.deepcopy(self.supports)
        row = copy.deepcopy(new["support_schedules"][0])
        row["amounts"]["p"] = 600000
        new["support_schedules"].append(row)
        with self.assertRaises(ValueError):
            flatten_supports(new)


if __name__ == "__main__":
    unittest.main()
