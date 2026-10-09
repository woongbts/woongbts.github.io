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
   // Six category tiles, four distinct phone-purpose choices, eight real links.
   await page.waitForFunction(()=>document.getElementById('quick-order')?.dataset.activeCategory==='mobile' && document.querySelectorAll('#home-order-choices .home-order-option').length===4);
   const quickColors=await page.locator('.home-order-category').evaluateAll(nodes=>nodes.map(node=>{
     const st=getComputedStyle(node);
     const box=node.getBoundingClientRect();
     return {type:node.dataset.quickCategory,bg:st.backgroundColor,color:st.color,left:box.left,right:box.right};
   }));
   assert.equal(quickColors.length,6,target.name+' six category actions');
   assert.equal(new Set(quickColors.map(x=>x.bg)).size,6,target.name+' every category has its own background');
   quickColors.forEach(x=>{
     assert.equal(x.color,'rgb(255, 255, 255)',target.name+' '+x.type+' has white label');
     assert.ok(x.left>=-3 && x.right<=target.width+3,target.name+' '+x.type+' fits viewport');
   });
   const phoneColors=await page.locator('#home-order-choices .home-order-option').evaluateAll(nodes=>nodes.map(node=>{
     const st=getComputedStyle(node);
     const box=node.getBoundingClientRect();
     return {bg:st.backgroundColor,color:st.color,left:box.left,right:box.right,href:node.href};
   }));
   assert.equal(phoneColors.length,4,target.name+' four phone selections');
   assert.equal(new Set(phoneColors.map(x=>x.bg)).size,4,target.name+' each phone purpose has its own color');
   phoneColors.forEach(x=>{
     assert.equal(x.color,'rgb(255, 255, 255)',target.name+' phone choice is legible');
     assert.ok(x.left>=-3 && x.right<=target.width+3,target.name+' phone choice fits viewport');
   });
   const serviceButtons=await page.locator('.service-card .service-links a').evaluateAll(nodes=>nodes.map(node=>{
     const st=getComputedStyle(node),box=node.getBoundingClientRect();
     return {bg:st.backgroundColor,color:st.color,height:box.height,left:box.left,right:box.right,href:node.getAttribute('href')};
   }));
   assert.equal(serviceButtons.length,8,target.name+' eight consultation action links');
   serviceButtons.forEach(x=>{
     assert.ok(x.bg!=='rgba(0, 0, 0, 0)' && x.bg!=='rgb(255, 255, 255)',target.name+' service action has a fill');
     assert.ok(x.height>=44,target.name+' action is tall enough: '+JSON.stringify(x));
     assert.ok(x.left>=-3 && x.right<=target.width+3,target.name+' action fits: '+JSON.stringify(x));
   });
   await page.locator('[data-quick-category="mvno"]').click();
   await page.waitForFunction(()=>document.getElementById('quick-order')?.dataset.activeCategory==='mvno');
   assert.equal(await page.locator('#home-order-choices .home-order-option').count(),2,target.name+' switching to MVNO keeps its two links');
   await page.locator('[data-quick-category="mobile"]').click();
   await page.waitForFunction(()=>document.getElementById('quick-order')?.dataset.activeCategory==='mobile');
   assert.equal(await page.locator('#home-order-choices .home-order-option').count(),4,target.name+' mobile selections recover after switching');
   console.log('PASS',target.name,target.width+'px: 6 colored categories, 4 phone choices, 8 service actions and 11 typography regions');
   await context.close();
  }
 }finally{
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
