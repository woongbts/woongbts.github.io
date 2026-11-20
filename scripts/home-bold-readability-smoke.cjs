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
   await page.locator('#home-order-choices strong').first().waitFor();
   const expectations=[
    {css:'.home-order-heading .home-order-kicker',minSize:14,minWeight:850},
    {css:'.home-entry-grid strong',minSize:target.mobile?19:21,minWeight:700},
    {css:'.home-entry-grid span',minSize:target.mobile?14:15,minWeight:400},
    {css:'.home-entry-phone a',minSize:target.mobile?16:17,minWeight:800},
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
     entry:(()=>{const r=document.getElementById('home-order-choices').getBoundingClientRect();return{left:r.left,right:r.right}})(),
     trust:(()=>{const r=document.querySelector('.home-trust-rail').getBoundingClientRect();return{left:r.left,right:r.right}})(),
   }));
   for(const key of ['quick','entry','trust']){
    assert.ok(layout[key].left>=-3&&layout[key].right<=layout.width+3,
      target.name+' '+key+' overflow: '+JSON.stringify(layout));
   }
   // Three consultation/comparison entries with distinct fills, one direct-menu toggle.
   const entries=await page.locator('#home-order-choices > a, #home-order-choices > button').evaluateAll(nodes=>{
     const channels=value=>{
       const parts=(value.match(/[\d.]+/g)||[]).map(Number);
       return parts.slice(0,3);
     };
     const luminance=color=>{
       const rgb=channels(color).map(v=>{
         const s=v/255;
         return s<=0.03928?s/12.92:Math.pow((s+0.055)/1.055,2.4);
       });
       return 0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
     };
     const contrast=(a,b)=>{
       const l1=luminance(a),l2=luminance(b);
       return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
     };
     return nodes.map(node=>{
       const st=getComputedStyle(node),box=node.getBoundingClientRect();
       const strong=node.querySelector('strong');
       const color=strong?getComputedStyle(strong).color:st.color;
       return {
         label:node.getAttribute('id')||node.className,
         bg:st.backgroundColor,
         color,
         contrast:Number(contrast(color,st.backgroundColor).toFixed(2)),
         height:box.height,
         left:box.left,
         right:box.right,
         href:node.getAttribute('href')||''
       };
     });
   });
   assert.equal(entries.length,3,target.name+' three entry actions');
   assert.equal(new Set(entries.map(x=>x.bg)).size,3,target.name+' every entry action has its own fill');
   entries.forEach(x=>{
    assert.ok(x.bg!=='rgba(0, 0, 0, 0)' && x.bg!=='rgb(255, 255, 255)',target.name+' '+x.label+' has a solid fill');
    assert.ok(x.contrast>=4.5,target.name+' '+x.label+' label contrast too low: '+JSON.stringify(x));
    assert.ok(x.height>=90,target.name+' '+x.label+' tall enough: '+JSON.stringify(x));
    assert.ok(x.left>=-3 && x.right<=target.width+3,target.name+' '+x.label+' fits viewport');
   });
   const kakao=entries.find(x=>/kakao\.com/.test(x.href));
   assert.ok(kakao,target.name+' keep the Kakao consultation entry');
   const compare=entries.find(x=>/rates\.html/.test(x.href));
   assert.ok(compare,target.name+' keep the direct comparison entry');
   const phoneLink=page.locator('.home-entry-phone a').first();
   const phoneStyles=await phoneLink.evaluate(el=>{
     const st=getComputedStyle(el),box=el.getBoundingClientRect();
     return {bg:st.backgroundColor,color:st.color,height:box.height,left:box.left,right:box.right};
   });
   assert.ok(phoneStyles.bg!=='rgba(0, 0, 0, 0)' && phoneStyles.bg!=='rgb(255, 255, 255)',target.name+' phone entry has a solid fill');
   assert.ok(phoneStyles.height>=48,target.name+' phone entry tall enough');
   assert.ok(phoneStyles.left>=-3 && phoneStyles.right<=target.width+3,target.name+' phone entry fits viewport');
   // The direct product menu stays closed until asked, then offers every product route.
   assert.equal(await page.locator('#home-self-compare').isHidden(),true,target.name+' direct menu starts closed');
   await page.locator('#home-direct-toggle').click();
   await page.locator('#home-self-compare').waitFor({state:'visible'});
   assert.equal(await page.locator('#home-direct-toggle').getAttribute('aria-expanded'),'true',target.name+' toggle reports the open menu');
   const directLinks=await page.locator('#home-self-compare .home-direct-link').evaluateAll(nodes=>nodes.map(node=>{
     const box=node.getBoundingClientRect(),strong=node.querySelector('strong');
     return {
       href:node.getAttribute('href')||'',
       height:box.height,
       left:box.left,
       right:box.right,
       titleColor:strong?getComputedStyle(strong).color:''
     };
   }));
   assert.equal(directLinks.length,11,target.name+' eleven direct product links');
   directLinks.forEach(x=>{
    assert.ok(x.href&&x.href!=='#',target.name+' direct link has a destination: '+JSON.stringify(x));
    assert.ok(x.height>=44,target.name+' direct link tall enough: '+JSON.stringify(x));
    assert.ok(x.left>=-3 && x.right<=target.width+3,target.name+' direct link fits viewport: '+JSON.stringify(x));
   });
   for(const route of ['purpose=senior','purpose=kids','tab=studyphone','purpose=value','purpose=premium','tab=mvno','/freet/apply/','tab=internet','/rental/']){
    assert.ok(directLinks.some(x=>x.href.includes(route)),target.name+' direct menu keeps '+route);
   }
   await page.locator('#home-direct-toggle').click();
   await page.locator('#home-self-compare').waitFor({state:'hidden'});
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
   console.log('PASS',target.name,target.width+'px: 3 colored entry actions, 11 direct product links, 8 service actions and 12 typography regions');
   await context.close();
  }
 }finally{
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
