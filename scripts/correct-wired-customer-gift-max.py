from pathlib import Path
import re

JS=Path('assets/rates.js')
HTML=Path('rates.html')
js=JS.read_text(encoding='utf-8')
html=HTML.read_text(encoding='utf-8')

# Correct interpretation: customer gift = the MAX value in the policy sheet's gift-guide range,
# not the agency cash/commission/final-fee columns. Values below are in 10,000 KRW units.
new_block="""  const CUSTOMER_GIFT_MAX={
    SKB:{
      groups:['BASIC','WIFI','WINGS'],
      none:{100:10,500:17,1000:17},
      tv:{
        TV_BASIC_NEW:{100:29,500:37,1000:37},
        TV_SMART_PLUS:{100:29,500:47,1000:47},
        TV_ALL:{100:29,500:47,1000:47},
        SKB_TV_POP180:{100:30,500:35,1000:35}
      }
    },
    SKTNET:{
      groups:['WIFI'],
      none:{100:11,500:17,1000:17},
      tv:{
        SKTNET_TV_ECO:{100:40,500:43,1000:52},
        SKTNET_TV_STD:{100:40,500:43,1000:52},
        SKTNET_TV_ALL:{100:40,500:43,1000:52}
      }
    },
    KT:{
      groups:['BASIC','WIFI','WI'],
      none:{100:9,500:14,1000:14},
      tv:{
        TV_OTV_BASIC:{100:37,500:45,1000:45},
        TV_OTV12:{100:37,500:45,1000:45},
        TV_OTV15:{100:37,500:45,1000:45},
        TV_OTV_ALLG:{100:37,500:45,1000:45}
      },
      family:{
        none:{100:9,500:14,1000:14},
        tv:{
          TV_OTV_BASIC:{100:37,500:45,1000:45},
          TV_OTV12:{100:37,500:45,1000:45},
          TV_OTV15:{100:37,500:45,1000:45},
          TV_OTV_ALLG:{100:37,500:45,1000:45}
        }
      }
    },
    'LGU+':{
      groups:['BASIC'],
      none:{100:20,500:17,1000:17},
      tv:{
        TV_ECONOMY_PACK:{100:33,500:47,1000:47},
        TV_BASIC_PACK:{100:33,500:47,1000:47},
        TV_PREMIUM:{100:33,500:47,1000:47},
        TV_VOD_PREMIUM:{100:33,500:47,1000:47}
      }
    },
    LGHELLO:{
      groups:['BASIC'],
      none:{100:13,160:13,500:18,1000:20},
      tv:{
        TV_HD_ECONOMY:{100:13,160:13,500:18,1000:20},
        TV_UHD_ECONOMY:{100:30,160:30,500:35,1000:40},
        TV_UHD_NEW_BASIC:{100:30,160:30,500:35,1000:40},
        TV_UHD_NEWPREMIUM:{100:30,160:30,500:35,1000:40},
        TV_UHD_PRO_LIGHT:{160:30,500:35,1000:40},
        TV_UHD_PRO_MAX:{160:30,500:35,1000:40}
      }
    },
    SKYLIFE:{
      groups:['BASIC'],
      none:{100:10,200:12,500:14,1000:15},
      tv:{
        TV_IPIT_BASIC:{100:35,200:36,500:42,1000:48},
        TV_IPIT_PLUS:{100:35,200:36,500:42,1000:48}
      }
    }
  };"""

pattern=r"  const CUSTOMER_GIFT_MAX=\{.*?\n  \};"
js2,count=re.subn(pattern,new_block,js,count=1,flags=re.S)
if count!=1:
    raise SystemExit('CUSTOMER_GIFT_MAX block not found')
js=js2

old_label='<div><span>고객사은품</span><b id="internet-customer-gift">—</b></div>'
new_label='<div><span>고객 사은품 (현금+상품권)</span><b id="internet-customer-gift">—</b></div>'
if old_label not in html:
    raise SystemExit('customer gift label not found')
html=html.replace(old_label,new_label,1)

old_note='고객사은품은 선택 상품 기준 최대 금액이며 지역·설치 조건 등에 따라 달라질 수 있어 최종 상담 시 확인됩니다.'
new_note='고객 사은품은 2026-09-15 정책표의 경품가이드 ‘최대’ 기준(현금+상품권 합산)입니다. 지역·상품·설치 및 가입 조건, 정책 변동에 따라 실제 지급액은 달라질 수 있어 최종 상담 시 확인됩니다.'
if old_note not in html:
    raise SystemExit('customer gift note not found')
html=html.replace(old_note,new_note,1)

old_cache='assets/rates.js?v=20260916-6'
if old_cache not in html:
    raise SystemExit('cache buster not found')
html=html.replace(old_cache,'assets/rates.js?v=20260916-7',1)

JS.write_text(js,encoding='utf-8')
HTML.write_text(html,encoding='utf-8')
print('Corrected customer gift maxima to gift-guide MAX values from 2026-09-15 policy sheets.')
