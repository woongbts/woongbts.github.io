(()=>{'use strict';
window.WOONGBI_WIRED_MASTER={
version:'2026-10-06.1',
settop:{SKB:{name:'스마트3',fee:4400},SKTNET:{name:'스마트3',fee:4400},KT:{name:'기가지니 A',fee:3300},'LGU+':{name:'4K UHD4',fee:4400}},
rules:{
SKB:{
 internetMobile:{100:4400,500:11000,1000:13200},
 tvMobile:{100:4400,500:6600,1000:7700},
 verified:{
  '100|TV_BASIC_NEW':{noMobile:36300,mobile:31900,mobileDiscount:4400}
 }
},
SKTNET:{
 internetMobile:{100:4400,500:11000,1000:13200},
 tvMobile:{100:5500,500:6600,1000:7700}
},
KT:{
 verified:{'500|TV_OTV_BASIC':{noMobile:44000,mobile:38500,mobileDiscount:5500}},
 tvMobile100:[
  {id:'KT_100_TV_MOBILE_UNDER22',label:'모바일 월정액 22,000원 미만',discount:1650},
  {id:'KT_100_TV_MOBILE_22',label:'모바일 월정액 22,000원 이상',discount:3300},
  {id:'KT_100_TV_MOBILE_649',label:'모바일 월정액 64,900원 이상',discount:5500}
 ]
},
'LGU+':{
 tvMobile:{100:5500,500:9900,1000:13200},
 verified:{'100|TV_ECONOMY_PACK':{noMobile:39600,mobile:34100,mobileDiscount:5500}}
}
}
};
})();