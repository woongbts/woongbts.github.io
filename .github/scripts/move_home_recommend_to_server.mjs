import fs from 'node:fs';

{
  const path='index.html';
  let source=fs.readFileSync(path,'utf8');
  const old='<script src="/assets/recommendation-engine-v2.js?v=20260930-3" defer></script>';
  const replacement='<script src="/assets/home-recommend-api.min.js?v=20261001-1" defer></script>';
  if(!source.includes(old))throw new Error('legacy homepage recommendation script marker missing');
  if(source.includes('home-recommend-api.min.js'))throw new Error('homepage server recommendation bridge already wired');
  source=source.replace(old,replacement);
  if(source.includes('recommendation-engine-v2.js'))throw new Error('legacy homepage recommendation script reference remains');
  fs.writeFileSync(path,source,'utf8');
}

{
  const path='sw.js';
  let source=fs.readFileSync(path,'utf8');
  if(!source.includes('const CACHE="woongbi-pwa-20261001-5"'))throw new Error('service worker cache marker missing');
  source=source.replace('const CACHE="woongbi-pwa-20261001-5"','const CACHE="woongbi-pwa-20261001-6"');
  const old='"/assets/recommend-api-bridge.min.js","/assets/plan-recommend-api-bridge.min.js"';
  const replacement='"/assets/recommend-api-bridge.min.js","/assets/home-recommend-api.min.js","/assets/plan-recommend-api-bridge.min.js"';
  if(!source.includes(old))throw new Error('service worker recommendation bridge marker missing');
  source=source.replace(old,replacement);
  fs.writeFileSync(path,source,'utf8');
}

console.log('homepage recommendation now uses private server bridge');
