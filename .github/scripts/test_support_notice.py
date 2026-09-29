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

    def run_build(self, previous=None, checked_on='2026-09-29'):
        return build(self.old, self.catalog, self.plans, self.new, previous, checked_on=checked_on)

    def test_only_reference_amount_changes(self):
        self.new['support_schedules'][0]['amounts']['SKT-XP-2901'] = 600000
        result = self.run_build()
        self.assertEqual(result['refresh_change_count'], 2)
        self.assertEqual(result['support_amount_change_count'], 2)
        self.assertEqual(result['support_delta_count'], 2)
        self.assertEqual(len(result['changes']), 2)
        self.assertEqual(result['changes'][0]['before'], 500000)
        self.assertEqual(result['changes'][0]['plan_id'], 'SKT-XP-2901')
        self.assertEqual(result['changes'][0]['after'], 600000)

    def test_no_change_preserves_old_notice_but_updates_check_date(self):
        previous = {'date': '2026-09-22', 'id': 'old', 'changes': [{'example': True}]}
        result = self.run_build(previous)
        self.assertEqual(result['refresh_change_count'], 0)
        self.assertEqual(result['support_amount_change_count'], 0)
        self.assertEqual(result['support_entry_added_count'], 0)
        self.assertEqual(result['support_entry_removed_count'], 0)
        self.assertEqual(result['support_delta_count'], 0)
        self.assertEqual(result['date'], '2026-09-22')
        self.assertEqual(result['id'], 'old')
        self.assertEqual(result['checked_on'], '2026-09-29')

    def test_non_reference_amount_change_is_counted_without_customer_notice(self):
        extra_old = {'carrier': 'SKT', 'device_ids': ['d'], 'join_types': ['신규가입'],
                     'amounts': {'OTHER-PLAN': 100000}}
        extra_new = copy.deepcopy(extra_old)
        extra_new['amounts']['OTHER-PLAN'] = 120000
        self.old['support_schedules'].append(extra_old)
        self.new['support_schedules'].append(extra_new)
        previous = {'date': '2026-09-22', 'id': 'old', 'changes': [{'example': True}]}
        result = self.run_build(previous)
        self.assertEqual(result['support_amount_change_count'], 1)
        self.assertEqual(result['support_delta_count'], 1)
        self.assertEqual(result['refresh_change_count'], 0)
        self.assertEqual(result['date'], '2026-09-22')

    def test_added_and_removed_support_entries_are_separate_from_amount_changes(self):
        self.old['support_schedules'].append(
            {'carrier': 'SKT', 'device_ids': ['d'], 'join_types': ['신규가입'],
             'amounts': {'OLD-PLAN': 100000}}
        )
        self.new['support_schedules'].append(
            {'carrier': 'SKT', 'device_ids': ['d'], 'join_types': ['신규가입'],
             'amounts': {'NEW-PLAN': 100000}}
        )
        result = self.run_build()
        self.assertEqual(result['support_amount_change_count'], 0)
        self.assertEqual(result['support_entry_added_count'], 1)
        self.assertEqual(result['support_entry_removed_count'], 1)
        self.assertEqual(result['support_delta_count'], 2)

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
