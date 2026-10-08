import copy
import unittest
from build_support_notice import build, MAX_NOTICE_PER_CARRIER


class NoticeTests(unittest.TestCase):
    def setUp(self):
        self.catalog = {'devices': [
            {'id': 'd', 'carrier': 'SKT', 'name': '갤럭시 시험', 'release_date': '2026-09-01'}
        ]}
        self.plans = {'mobile_plans': [
            {'id': 'p-main', 'name': '5G 테스트', 'monthly_fee': 69000, 'carrier': 'SKT'},
            {'id': 'p-other', 'name': '시니어 테스트', 'monthly_fee': 45000, 'carrier': 'SKT'},
        ]}
        self.old = {'meta': {'updated_at': '2026-09-23'}, 'support_schedules': [
            {'carrier': 'SKT', 'device_ids': ['d'],
             'join_types': ['기기변경', '번호이동'],
             'amounts': {'p-main': 500000}},
        ]}
        self.new = copy.deepcopy(self.old)

    def run_build(self, previous=None, checked_on='2026-10-08'):
        return build(self.old, self.catalog, self.plans, self.new,
                     previous=previous, checked_on=checked_on)

    def test_verified_amount_change_triggers_customer_popup(self):
        self.new['support_schedules'][0]['amounts']['p-main'] = 600000
        result = self.run_build()
        self.assertEqual(result['refresh_change_count'], 2)
        self.assertEqual(result['notice_total_count'], 2)
        self.assertEqual(result['support_amount_change_count'], 2)
        self.assertEqual(len(result['changes']), 2)
        self.assertEqual(result['changes'][0]['before'], 500000)
        self.assertEqual(result['changes'][0]['after'], 600000)

    def test_unlisted_plan_amount_change_now_triggers_popup(self):
        a = {'carrier': 'SKT', 'device_ids': ['d'], 'join_types': ['신규가입'],
             'amounts': {'p-other': 100000}}
        self.old['support_schedules'].append(a)
        replacement = copy.deepcopy(a)
        replacement['amounts']['p-other'] = 120000
        self.new['support_schedules'].append(replacement)
        result = self.run_build()
        self.assertEqual(result['support_amount_change_count'], 1)
        self.assertEqual(result['refresh_change_count'], 1)
        self.assertEqual(result['changes'][0]['plan'], '시니어 테스트')

    def test_no_changes_preserve_previous_notice_without_new_popup(self):
        old_notice = {'version': 1, 'date': '2026-09-22', 'id': 'old',
                      'changes': [{'example': True}]}
        result = self.run_build(previous=old_notice)
        self.assertEqual(result['refresh_change_count'], 0)
        self.assertEqual(result['notice_total_count'], 0)
        self.assertEqual(result['support_delta_count'], 0)
        self.assertEqual(result['date'], '2026-09-22')
        self.assertEqual(result['id'], 'old')
        self.assertEqual(result['checked_on'], '2026-10-08')

    def test_added_and_removed_support_entries_are_not_money_deltas(self):
        old_extra = {'carrier': 'SKT', 'device_ids': ['d'],
                     'join_types': ['신규가입'], 'amounts': {'p-main': 100000}}
        new_extra = {'carrier': 'SKT', 'device_ids': ['d'],
                     'join_types': ['신규가입'], 'amounts': {'p-other': 120000}}
        self.old['support_schedules'].append(old_extra)
        self.new['support_schedules'].append(new_extra)
        result = self.run_build()
        self.assertEqual(result['support_amount_change_count'], 0)
        self.assertEqual(result['support_entry_added_count'], 1)
        self.assertEqual(result['support_entry_removed_count'], 1)
        self.assertEqual(result['refresh_change_count'], 0)
        self.assertEqual(result['changes'], [])

    def test_future_product_is_not_advertised(self):
        self.catalog['devices'][0]['name'] = '아이폰 17 256GB(NEW)'
        self.new['support_schedules'][0]['amounts']['p-main'] = 600000
        result = self.run_build(checked_on='2026-09-29')
        self.assertEqual(result['changes'], [])

    def test_missing_support_is_not_zero_and_cannot_trigger_popup(self):
        self.new['support_schedules'][0]['amounts'] = {}
        result = self.run_build()
        self.assertEqual(result['changes'], [])
        self.assertEqual(result['refresh_change_count'], 0)
        self.assertEqual(result['support_entry_removed_count'], 2)
        self.new['support_schedules'][0]['amounts'] = {'p-main': 0}
        result = self.run_build()
        self.assertEqual(result['changes'][0]['after'], 0)

    def test_unknown_plan_cannot_appear_in_notice(self):
        self.new['support_schedules'][0]['amounts'] = {'p-main': 500000, 'unknown': 900000}
        result = self.run_build()
        self.assertEqual(result['changes'], [])
        self.assertEqual(result['support_entry_added_count'], 2)

    def test_representative_cap_and_all_changes_still_counted(self):
        self.catalog['devices'] = [
            {'id': f'd{i}', 'carrier': 'SKT', 'name': f'폰{i}', 'release_date': '2026-10-01'}
            for i in range(MAX_NOTICE_PER_CARRIER + 6)
        ]
        device_ids = [d['id'] for d in self.catalog['devices']]
        self.old['support_schedules'][0]['device_ids'] = device_ids
        self.new['support_schedules'][0]['device_ids'] = device_ids
        self.new['support_schedules'][0]['amounts']['p-main'] = 550000
        result = self.run_build()
        self.assertEqual(len(result['changes']), MAX_NOTICE_PER_CARRIER)
        self.assertEqual(result['notice_total_count'], 2 * len(device_ids))
        self.assertEqual(result['support_amount_change_count'], 2 * len(device_ids))


if __name__ == '__main__':
    unittest.main()
