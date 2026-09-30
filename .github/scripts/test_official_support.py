import unittest
from unittest.mock import patch
from official_support import verified_lgu_support, valid_public_support, normalized_model

class OfficialSupportTest(unittest.TestCase):
    def test_carrier_support_is_not_online_store_total(self):
        plans=[{"urcMblPpCd":"test-plan", "urcMblPpNm":"데이터플랜80GB(유쓰+30GB)", "urcPpBasfAmt":"66000"}]
        rows=[{"urcTrmMdlCd":"SM-S948N1TB", "dlvrPrc":2545400,
               "basicPlanPuanSuptAmt":390000,"sixPlanPuanSuptAmt":390000,
               "basicPlanSuptTamt":448500,"dsnwSupportAmt":58500}]
        with patch('official_support.official_plans',return_value=plans), patch('official_support.official_rows',return_value=rows):
            self.assertEqual(verified_lgu_support('SM-S948N1T',2545400,'데이터플랜80GB(Uth+30GB)',66000,'번호이동'),390000)
            with self.assertRaises(RuntimeError):
                verified_lgu_support('SM-S948N1T',2545400,'데이터플랜80GB(Uth+30GB)',68000,'번호이동')
            with self.assertRaises(RuntimeError):
                verified_lgu_support('SM-S948N1T',2050400,'데이터플랜80GB(Uth+30GB)',66000,'번호이동')
    def test_invalid_official_value_cannot_be_published(self):
        self.assertTrue(valid_public_support(390000,1254000))
        self.assertTrue(valid_public_support(0,1254000))
        for amount in [3120000,-1,1.5,None,True]:
            self.assertFalse(valid_public_support(amount,1254000))
        self.assertEqual(normalized_model('SM-S948N1T'),normalized_model('SM-S948N1TB'))

if __name__=='__main__':
    unittest.main()
