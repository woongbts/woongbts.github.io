'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true});
 const testCases=[
  {name:'desktop',width:1280,height:900,mobile:false},
  {name:'iPhone',width:390,height:844,mobile:true},
  {name:'small Android',width:360,height:780,mobile:true}
 ];
 try{
  for(const target of testCases){
   const context=await browser.newContext({viewport:{width:target.width,height:target.height},deviceScaleFactor:1,serviceWorkers:'block'});
   const page=await context.newPage();
   await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
   await page.locator('.home-order-category small').first().waitFor();
   const expectations=[
    {css:'.home-order-heading .home-order-kicker',minSize:14,minWeight:850},
    {css:'.home-order-category small',minSize:target.mobile?14:16,minWeight:700},
    {css:'.home-order-option small',minSize:target.mobile?14:16,minWeight:700},
    {css:'.home-order-disclaimer',minSize:target.mobile?14:15,minWeight:700},
    {css:'.hero .intro',minSize:target.mobile?16:18,minWeight:700},
    {css:'.home-trust-rail span',minSize:target.mobile?14:15,minWeight:700},
    {css:'.service-card>p',minSize:target.mobile?16:17,minWeight:700},
    {css:'.owner-note>p',minSize:target.mobile?16:17,minWeight:700},
    {css:'.principle p',minSize:target.mobile?16:17,minWeight:700},
    {css:'#location .details dt',minSize:16,minWeight:800},
    {css:'#location .details dd',minSize:target.mobile?17:18,minWeight:800},
   ];
   for(const row of expectations){
    const item=page.locator(row.css).first();
    assert.equal(await item.count(),1,'missing '+row.css);
    const styles=await item.evaluate(el=>{
      const s=getComputedStyle(el);
      return {fontSize:parseFloat(s.fontSize),fontWeight:parseInt(s.fontWeight,10),lineHeight:s.lineHeight};
    });
    assert.ok(styles.fontSize>=row.minSize-0.15,target.name+' '+row.css+' too small: '+JSON.stringify(styles));
    assert.ok(styles.fontWeight>=row.minWeight,target.name+' '+row.css+' insufficiently bold: '+JSON.stringify(styles));
   }
   const layout=await page.evaluate(()=>({
     width:window.innerWidth,
     quick:(()=>{const r=document.querySelector('.home-order').getBoundingClientRect();return{left:r.left,right:r.right}})(),
     category:(()=>{const r=document.querySelector('.home-order-category').getBoundingClientRect();return{left:r.left,right:r.right}})(),
     trust:(()=>{const r=document.querySelector('.home-trust-rail').getBoundingClientRect();return{left:r.left,right:r.right}})(),
   }));
   for(const key of ['quick','category','trust']){
    assert.ok(layout[key].left>=-3&&layout[key].right<=layout.width+3,
      target.name+' '+key+' overflow: '+JSON.stringify(layout));
   }
   console.log('PASS',target.name,target.width+'px: 11 bold copy areas and 3 responsive layout bounds');
   await context.close();
  }
 }finally{
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
