"""Preview alternate product photos before allowing them into the rental catalog."""
import base64,io
from pathlib import Path
from urllib.parse import quote
import requests
from PIL import Image,ImageDraw,ImageFont,ImageOps

CANDIDATES=[
("LaCloud Q main on source listing","https://storage.bilrigo.com/data/thumbnails/250526/LaHyzmkwlNnU35rStwdA4776dPFGbW.jpg"),
("LaCloud Q current original","https://storage.bilrigo.com/data/thumbnails/250526/u73pxP1qDdjztuAeKvPhewsMVqSaKm.jpg"),
("Inhome Anna SS retailer main","https://devadmin.tncrental.co.kr/uploads/goods/G047253/nXTmexjVYe.jpg"),
("Inhome Anna SS original","https://storage.bilrigo.com/data/thumbnails/230412/FH6gwkbWxLAtJuzBq2K7zywjWNgfFY.jpg"),
]
font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",18)
out=Image.new("RGB",(1040,1100),"#f2f2f2")
for i,(label,url) in enumerate(CANDIDATES):
  s=requests.Session()
  b=None
  for u in (url,"https://images.weserv.nl/?url="+quote(url,safe="")+"&w=900&output=jpg"):
    try:
      r=s.get(u,headers={"User-Agent":"Mozilla/5.0","Referer":"https://bilrigo.com/"},timeout=12)
      r.raise_for_status()
      im=Image.open(io.BytesIO(r.content))
      im.load()
      b=ImageOps.contain(im.convert("RGB"),(490,470),Image.Resampling.LANCZOS)
      break
    except Exception as e:
      err=str(e)[:70]
  x=(i%2)*520
  y=(i//2)*550
  if b:out.paste(b,(x+(520-b.width)//2,y+40+(475-b.height)//2))
  ImageDraw.Draw(out).text((x+10,y+10),str(i+1)+" "+label,font=font,fill="#161616")
  if b is None:ImageDraw.Draw(out).text((x+10,y+80),"NOT AVAILABLE: "+err,font=font,fill="#990000")
dest=Path("rental/assets/product-image-audit")
dest.mkdir(parents=True,exist_ok=True)
out.save(dest/"alternate-photo-preview.jpg","JPEG",quality=80)
(dest/"alternate-photo-preview.jpg.b64").write_text(base64.b64encode((dest/"alternate-photo-preview.jpg").read_bytes()).decode("ascii"))
print("Preview images saved")
