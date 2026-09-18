from pathlib import Path

for path in ('src/rates.js','assets/rates.min.js'):
    p=Path(path)
    s=p.read_text(encoding='utf-8')
    old='const best=known[0],data=q(p),dataScore=M(p)?1e6:Number.isFinite(data)?Number(data):0;'
    new='const best=known[0],data=q(p),rawData=String(p.data||"").toLowerCase().replace(/\\s+/g,""),dataScore=rawData.includes("완전무제한")||rawData==="무제한"?1e6:Number.isFinite(data)?Number(data):M(p)?1e5:0;'
    if old not in s:
        raise SystemExit(f'data score marker missing in {path}')
    p.write_text(s.replace(old,new,1),encoding='utf-8')
