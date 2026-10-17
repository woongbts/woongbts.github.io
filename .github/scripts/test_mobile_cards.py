import copy
import unittest
from sync_mobile_cards import normalize, collect


class CardSyncTests(unittest.TestCase):
    def sample(self):
        return {'card_idx':'1000','card_name':'공개 테스트 카드','category':'POST','card_type':'CHARGE',
                'benefit':'■ 기본 할인\n전월실적 30만원 이상 10,000원 할인\n■ 신규등록 2개월간 실적 유예',
                'contents':'공과금 실적 제외','discount':[{'discount_idx':'1','charge_money':'30만원 이상','monthly_discount':'10000'}],
                'promotion_contents':'■ 프로모션 (~26.10.31까지)\n직전 6개월간 무실적 고객\n- 혜택: 24개월 동안 추가 할인 제공'}

    def test_period_is_not_new_card_grace_period(self):
        result=normalize(self.sample(),'SKT','2026-10-17')
        self.assertIsNone(result['basicMonths'])
        self.assertEqual(result['promotionMonths'],24)
        self.assertEqual(result['promotionDeadline'],'2026-10-31')

    def test_source_row_discrepancy_does_not_invent_eligibility(self):
        sample=self.sample();sample['discount'][0]['charge_money']='20만원 이상'
        result=normalize(sample,'KT','2026-10-17')
        self.assertFalse(result['tiers'][0]['verified'])
        self.assertTrue(any(t['minSpend']==300000 and t['verified'] for t in result['tiers']))

    def test_html_is_text_not_executable_markup(self):
        sample=self.sample();sample['card_name']='<b>카드명</b>'
        self.assertEqual(normalize(sample,'LGU+','2026-10-17')['name'],'카드명')

    def test_empty_and_incomplete_source_abort(self):
        for response in [{'result':{'result_cnt':0}}, {'result':{'result_cnt':3},'data':[]}]:
            with self.assertRaises(ValueError):collect(lambda path:copy.deepcopy(response),'2026-10-17')


if __name__=='__main__':unittest.main()
