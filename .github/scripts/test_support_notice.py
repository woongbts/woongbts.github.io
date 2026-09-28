import copy
import unittest
from build_support_notice import build, REFERENCES


class NoticeTests(unittest.TestCase):
    def setUp(self):
        self.catalog = {'devices': [{'id': 'd', 'carrier': 'SKT', 'name': '갤럭시 시험'}]}
        self.plans = {'mobile_plans': [{'id': pid, 'name': name, 'monthly_fee': 109000}
                      for pid, name in REFERENCES.values()]}
        self.old = {'meta': {'updated_at': '2026-09-23'}, 'support_schedules': [
            {'carrier': 'SKT', 'device_ids': ['d'], 'join_types': ['기기변경', '번호이동'],
             'amounts': {'SKT-XP-2901': 500000}}]}
        self.new = copy.deepcopy(self.old)
        self.new['meta']['updated_at'] = '2026-09-24'

    def run_build(self, previous=None):
        return build(self.old, self.catalog, self.plans, self.new, previous)

    def test_only_reference_amount_changes(self):
        self.new['support_schedules'][0]['amounts']['SKT-XP-2901'] = 600000
        result = self.run_build()
        self.assertEqual(len(result['changes']), 2)
        self.assertEqual(result['changes'][0]['before'], 500000)
        self.assertEqual(result['changes'][0]['plan_id'], 'SKT-XP-2901')
        self.assertEqual(result['changes'][0]['after'], 600000)

    def test_no_change_does_not_make_old_notice_today(self):
        previous = {'date': '2026-09-22', 'id': 'old', 'changes': [{'example': True}]}
        result = self.run_build(previous)
        self.assertEqual(result['date'], '2026-09-22')
        self.assertEqual(result['id'], 'old')
        self.assertEqual(result['checked_on'], '2026-09-24')

    def test_future_iphone_not_advertised(self):
        self.catalog['devices'][0]['name'] = '아이폰 17 256GB(NEW)'
        self.new['support_schedules'][0]['amounts']['SKT-XP-2901'] = 600000
        self.assertEqual(self.run_build()['changes'], [])

    def test_missing_is_not_zero(self):
        self.new['support_schedules'][0]['amounts'] = {}
        self.assertIsNone(self.run_build()['changes'][0]['after'])
        self.new['support_schedules'][0]['amounts'] = {'SKT-XP-2901': 0}
        self.assertEqual(self.run_build()['changes'][0]['after'], 0)

    def test_reference_plan_mismatch_fails(self):
        self.plans['mobile_plans'][0]['name'] = '다른 요금제'
        with self.assertRaises(ValueError):
            self.run_build()


if __name__ == '__main__':
    unittest.main()
