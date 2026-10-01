import fs from 'node:fs';

const source = fs.readFileSync('src/rates.js','utf8');

function extractFunctions(src) {
  const out=[];
  const re=/function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g;
  let m;
  while((m=re.exec(src))){
    const open=src.indexOf('{',m.index), name=m[1];
    let depth=1,i=open+1,quote=null,escape=false;
    for(;i<src.length&&depth;i++){
      const ch=src[i];
      if(quote){
        if(escape){escape=false;continue}
        if(ch==='\\'){escape=true;continue}
        if(ch===quote)quote=null;
        continue;
      }
      if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue}
      if(ch==='{')depth++;
      else if(ch==='}')depth--;
    }
    if(depth===0) out.push({name,start:m.index,end:i,body:src.slice(m.index,i)});
  }
  return out;
}

const funcs=extractFunctions(source);
console.log('FUNCTION_COUNT',funcs.length);
for(const target of ['N','R','W','T','ce','ae','se','ze','Ge']){
  const fn=funcs.find(x=>x.name===target);
  console.log(`\n=== FUNCTION ${target} ===`);
  if(!fn){console.log('MISSING');continue}
  console.log(fn.body.slice(0,4000));
}

for(const token of ['N(','R(','W(','T(','ce(','ae(','se(','ze(','Ge(','monthly-total','quote-copy','quote-save','quote-share']){
  const users=funcs.filter(fn=>fn.body.includes(token)).map(fn=>fn.name);
  const count=source.split(token).length-1;
  console.log(`\nTOKEN ${token} count=${count} functions=${users.join(',')}`);
  let from=0,shown=0;
  while(shown<8){
    const at=source.indexOf(token,from);if(at<0)break;
    console.log('CTX',source.slice(Math.max(0,at-180),Math.min(source.length,at+260)).replace(/\s+/g,' '));
    from=at+token.length;shown++;
  }
}
