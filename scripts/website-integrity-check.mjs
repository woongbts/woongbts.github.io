import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const read = p => fs.readFileSync(path.join(process.cwd(),p),'utf8');
const data=JSON.parse(read('rental/data/products.json'));
const gallery=JSON.parse(read('rental/data/clover-detail-gallery.json'));
const errors=[];
const assert=(ok,message)=>{if(!ok)errors.push(message);};
const products=data.products||[];
const active=products.filter(p=>p.availability!=='inactive' && !/단종|접수불가|접수중지/.test(String(p.name||'')));
const ids=new Set();
for(const p of products){
  assert(p.id&&!ids.has(p.id),'Missing or duplicate product ID: '+p.id);
  ids.add(p.id);
  for(const o of p.options||[]){
    if(o.monthly!=null)assert(Number.isFinite(Number(o.monthly)) && Number(o.monthly)>=0, 'Invalid monthly amount: '+p.id);
    if(o.gift!=null)assert(Number.isFinite(Number(o.gift)) && Number(o.gift)>=0, 'Invalid gift amount: '+p.id);
  }
}
let withDetail=0,images=0;
for(const p of active){
  const urls=gallery.products?.[p.id]?.detailImages || p.detailImages || [];
  if(urls.length)withDetail++;
  for(const u of urls){
    images++;
    assert(typeof u==='string' && (/^https?:\/\//.test(u)||(/^assets\//.test(u)&&!u.includes('..'))),'Invalid detail image URL: '+p.id);
  }
}
assert(active.length>=400,'Unexpected catalog shrink: '+active.length);
assert(withDetail/active.length>=0.98,'Detailed galleries cover fewer than 98% of active products: '+withDetail+'/'+active.length);
const pages=['rental/index.html','rental/food-waste-disposer/index.html','rental/massage-chair/index.html','rental/mattress/index.html','rental/hwamyeong/index.html','rental/deokcheon/index.html'];
for(const p of pages)assert(fs.existsSync(p),'Missing discovery/SEO page: '+p);
const home=read('rental/index.html');
for(const q of ['data-quick-rental-query="음식물처리기"','data-quick-rental-category="안마의자"','food-waste-disposer/'])assert(home.includes(q),'Fast product search missing '+q);
assert(read('rental/food-disposer-sitemap.xml').includes('https://woongbts.github.io/rental/food-waste-disposer/'),'Dedicated food disposal sitemap missing listing');
assert(read('robots.txt').includes('food-disposer-sitemap.xml'),'Robots.txt must point to the dedicated site map');
const catalog=read('rental/assets/catalog.js');
assert(catalog.includes('const pairedOffer = recommendationMetrics(product);'),'Catalogue must display a paired rental option');
assert(catalog.includes('같은 조건 고객사은품'),'Catalogue gift must be labelled as same-option gift');
const internet=read('assets/internet-ui.min.js');
assert(internet.includes('extraTvKnown')&&internet.includes(":'상담 확인'"),'Internet extras must fail safely');
assert(read('rates.html').includes('id="store-application-quick-kakao"'),'Secure consultation fallback missing');
for(const p of ['rental/assets/catalog.js','rental/assets/product-generic.js','assets/store-applications.js','assets/internet-ui.min.js','rental/assets/ai-recommend.js']){
  try{new vm.Script(read(p),{filename:p});}catch(e){errors.push('JavaScript parse error '+p+': '+e.message);}
}
// Ensure that every advertised category price and gift is a REAL matched contract option.
// Fail CI when a source catalogue update leaves a static landing page showing stale figures.
const categoryGuides=['water-purifier','air-purifier','bidet','massage-chair','mattress','laundry','kitchen-appliance','tv-digital','furniture-bed','health-beauty','home-appliance','refrigerator','leisure-auto','aircon-cleaner'];
const productIndex=new Map(products.map(p=>[String(p.id),p]));
const warnings=[];
let checkedCategoryOffers=0;
for(const dir of categoryGuides){
  const page='rental/'+dir+'/index.html';
  assert(fs.existsSync(page),'Missing category landing page: '+page);
  if(!fs.existsSync(page))continue;
  const html=read(page);
  const sourceDate=html.match(/data-source-date="(\d{4}-\d{2}-\d{2})"/)?.[1]||'';
  if(sourceDate){
    const age=Math.floor((Date.now()-new Date(sourceDate+'T00:00:00Z').getTime())/86400000);
    if(Number.isFinite(age)&&age>45)warnings.push('Old category price policy '+page+': '+sourceDate+' ('+age+' days)');
  }
  const cards=[...html.matchAll(/<article class="category-product">([\s\S]*?)<\/article>/g)];
  for(const [,card] of cards){
    const link=card.match(/href="product\/([^/"]+)\/\?mgmt=([^&"]+)&amp;term=([^"]+)"/);
    const monthly=card.match(/월 렌탈료<strong>([\d,]+)원/);
    const gift=card.match(/같은 조건 사은품<strong>([\d,]+원|상담 확인)/);
    if(!link||!monthly||!gift){assert(false,'Incomplete price/benefit card on '+page);continue;}
    const id=decodeURIComponent(link[1]),mgmt=decodeURIComponent(link[2]),term=decodeURIComponent(link[3]);
    const p=productIndex.get(id);
    const matched=(p?.options||[]).some(o=>o.management===mgmt&&String(o.term)===term
      &&Number(o.monthly)===Number(monthly[1].replaceAll(',',''))
      &&(gift[1]==='상담 확인' ? o.gift==null || o.gift==='' : Number(o.gift)===Number(gift[1].replace('원','').replaceAll(',',''))));
    assert(matched,'Price/gift mismatch: '+page+' / '+id+' ('+mgmt+' / '+term+')');
    checkedCategoryOffers++;
  }
}
assert(checkedCategoryOffers>=100,'Unexpectedly few verified category offers: '+checkedCategoryOffers);
// Conversion events contain product IDs and anonymous funnel stages, not customer contact details.
const tracker=read('assets/conversion-tracker.min.js');
const funnel=read('assets/funnel-observer.js');
for(const evt of ['rental_product_view','rental_apply_open','rental_apply_submit','rental_apply_success','store_apply_open','store_apply_submit','store_apply_success','rate_calculator_start','mobile_quote_result_view','internet_compare_view']){
  assert(tracker.includes('"'+evt+'"')||tracker.includes("'"+evt+"'"),'Funnel event not supported by conversion sender: '+evt);
}
assert(funnel.includes("rate_calculator_start")&&funnel.includes("mobile_quote_result_view"),'Missing telecom quote-funnel instrumentation');
console.log(JSON.stringify({activeProducts:active.length,withDetail,percent:(100*withDetail/active.length).toFixed(1),detailImageReferences:images,checkedScripts:5,checkedCategoryOffers,warnings,errors},null,2));
if(errors.length)process.exit(1);
