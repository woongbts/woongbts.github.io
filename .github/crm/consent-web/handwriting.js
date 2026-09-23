export const MAX_POINTS=2500;
export function validateHandwriting(value){
 if(!Array.isArray(value)||!value.length||value.length>128)throw new Error('손글씨를 작성해 주세요.');
 let count=0,length=0;
 const paths=value.map(path=>{
  if(!Array.isArray(path)||path.length<2)throw new Error('손글씨를 다시 작성해 주세요.');
  const points=path.map(point=>{
   if(!Array.isArray(point)||point.length!==2||point.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>1))throw new Error('손글씨 형식이 올바르지 않습니다.');
   if(++count>MAX_POINTS)throw new Error('손글씨가 너무 깁니다. 지우고 간단히 다시 작성해 주세요.');
   return point.map(n=>Math.round(n*10000)/10000);
  });
  for(let i=1;i<points.length;i++)length+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
  return points;
 });
 if(count<4||length<0.08)throw new Error('점만 찍지 말고 이름 또는 서명을 작성해 주세요.');
 return paths;
}
export function renderHandwriting(canvas,paths){
 const ctx=canvas.getContext('2d');
 ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.strokeStyle='#143e4c';ctx.lineWidth=3.5;ctx.lineCap='round';ctx.lineJoin='round';
 for(const path of paths){if(!path.length)continue;ctx.beginPath();ctx.moveTo(path[0][0]*canvas.width,path[0][1]*canvas.height);for(const p of path.slice(1))ctx.lineTo(p[0]*canvas.width,p[1]*canvas.height);ctx.stroke();}
}
export function createHandwritingPad(canvas,onChange,onError){
 let paths=[],current=null,pointer=null;
 const total=()=>paths.reduce((n,p)=>n+p.length,0)+(current?.length||0);
 function point(event){const r=canvas.getBoundingClientRect();return [Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(event.clientY-r.top)/r.height))].map(n=>Math.round(n*10000)/10000);}
 function paint(){renderHandwriting(canvas,current?[...paths,current]:paths);}
 canvas.addEventListener('pointerdown',e=>{
  if(pointer!==null||!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0)||canvas.getAttribute('aria-disabled')==='true')return;
  if(paths.length>=128||total()>=MAX_POINTS){onError('지우고 간단히 다시 작성해 주세요.');return;}
  e.preventDefault();pointer=e.pointerId;current=[point(e)];canvas.setPointerCapture(pointer);onChange();
 });
 canvas.addEventListener('pointermove',e=>{
  if(e.pointerId!==pointer||!current)return;e.preventDefault();
  const p=point(e),last=current.at(-1);
  if(Math.hypot(p[0]-last[0],p[1]-last[1])<0.002)return;
  if(total()>=MAX_POINTS){onError('손글씨 길이 한도입니다. 지우고 다시 작성해 주세요.');return;}
  current.push(p);paint();onChange();
 });
 function end(e,cancel=false){
  if(e.pointerId!==pointer)return;
  if(!cancel&&current?.length>=2)paths.push(current);
  if(canvas.hasPointerCapture(pointer))canvas.releasePointerCapture(pointer);
  current=null;pointer=null;paint();onChange();
 }
 canvas.addEventListener('pointerup',e=>end(e));
 canvas.addEventListener('pointercancel',e=>end(e,true));
 return {clear(){if(pointer!==null&&canvas.hasPointerCapture(pointer))canvas.releasePointerCapture(pointer);paths=[];current=null;pointer=null;paint();},
  value(){return validateHandwriting(paths);},setDisabled(disabled){canvas.setAttribute('aria-disabled',String(disabled));}};
}
