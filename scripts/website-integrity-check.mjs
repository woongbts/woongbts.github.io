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
    assert(typeof u==='string' && (/^https:\/\//.test(u)||/^assets\/product-detail-images\//.test(u)),'Invalid detail image URL: '+p.id);
  }
}
assert(active.length>=400,'Unexpected catalog shrink: '+active.length);
assert(withDetail/active.length>=0.98,'Detailed galleries cover fewer than 98% of active products: '+withDetail+'/'+active.length);
const pages=['rental/index.html','rental/food-waste-disposer/index.html','rental/massage-chair/index.html','rental/mattress/index.html','rental/hwamyeong/index.html','rental/deokcheon/index.html'];
for(const p of pages)assert(fs.existsSync(p),'Missing discovery/SEO page: '+p);
const home=read('rental/index.html');
for(const q of ['data-quick-rental-query="음식물처리기"','data-quick-rental-category="안마의자"','food-waste-disposer/'])assert(home.includes(q),'Fast product search missing '+q);
for(const p of ['rental/sitemap.xml','sitemap.xml'])assert(read(p).includes('https://woongbts.github.io/rental/food-waste-disposer/'),'Guide missing from sitemap: '+p);
const catalog=read('rental/assets/catalog.js');
assert(catalog.includes('const pairedOffer = recommendationMetrics(product);'),'Catalogue must display a paired rental option');
assert(catalog.includes('같은 조건 고객사은품'),'Catalogue gift must be labelled as same-option gift');
const internet=read('assets/internet-ui.min.js');
assert(internet.includes('extraTvKnown')&&internet.includes(":'상담 확인'"),'Internet extras must fail safely');
assert(read('rates.html').includes('id="store-application-quick-kakao"'),'Secure consultation fallback missing');
for(const p of ['rental/assets/catalog.js','rental/assets/product-generic.js','assets/store-applications.js','assets/internet-ui.min.js','rental/assets/ai-recommend.js']){
  try{new vm.Script(read(p),{filename:p});}catch(e){errors.push('JavaScript parse error '+p+': '+e.message);}
}
console.log(JSON.stringify({activeProducts:active.length,withDetail,percent:(100*withDetail/active.length).toFixed(1),detailImageReferences:images,checkedScripts:5,errors},null,2));
if(errors.length)process.exit(1);
