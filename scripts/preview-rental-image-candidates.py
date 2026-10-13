"""Preview alternate product photos before allowing them into the rental catalog."""
import base64,io
from pathlib import Path
from urllib.parse import quote
import requests
from PIL import Image,ImageDraw,ImageFont,ImageOps

CANDIDATES=[["LaCloud 01","https://rentalshop.site/_data/file/goodsImages/9a07fc09443f4f9c01212f57a0b12829.jpg"],["LaCloud 02","https://rentalshop.site/_data/file/goodsImages/31c63404208272f21c2d504f8165f615.jpg"],["LaCloud 03","https://rentalshop.site/_data/file/goodsImages/3e886e08a016ba0818332fa75c5ed040.jpg"],["LaCloud 04","https://rentalshop.site/_data/file/goodsImages/f9dbbba13aa32e270c04786b2820b145.jpg"],["LaCloud 05","https://rentalshop.site/_data/file/goodsImages/19c21befb2e2fb3d08da43ba1241243d.jpg"],["LaCloud 06","https://rentalshop.site/_data/file/goodsImages/731988cd636ebd4682b0c1099fecd12a.jpg"],["LaCloud 07","https://rentalshop.site/_data/file/goodsImages/9f5ae09e9dcd6b0357ef0f437a3b1360.jpg"],["LaCloud 08","https://rentalshop.site/_data/file/goodsImages/4651897056bfb7ac7217d9f2ff118c27.jpg"],["LaCloud 09","https://rentalshop.site/_data/file/goodsImages/ff6f3a484b2bbc36eb7276d1fa9b2eb2.jpg"],["Inhome 01","https://img.danuri.io/catalog-image/669/821/012/24247aabc03f4a169ad459d6da55e390.jpg"],["Inhome 02","https://exp.enuri.com/proxy/gdimg.gmarket.co.kr/4740710264/goodsimage?ver=38451129418"],["Inhome 03","https://exp.enuri.com/proxy/gdimg.gmarket.co.kr/4740710259/goodsimage?ver=38451257248"]]

font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",18)
out=Image.new("RGB",(1560,1650),"#f2f2f2")
for i,(label,url) in enumerate(CANDIDATES):
  s=requests.Session()
  b=None
  for u in (url,"https://images.weserv.nl/?url="+quote(url,safe="")+"&w=900&output=jpg"):
    try:
      r=s.get(u,headers={"User-Agent":"Mozilla/5.0","Referer":"https://bilrigo.com/"},timeout=12)
      r.raise_for_status()
      im=Image.open(io.BytesIO(r.content))
      im.load()
      b=ImageOps.contain(im.convert("RGB"),(490,330),Image.Resampling.LANCZOS)
      break
    except Exception as e:
      err=str(e)[:70]
  x=(i%3)*520
  y=(i//3)*410
  if b:out.paste(b,(x+(520-b.width)//2,y+40+(340-b.height)//2))
  ImageDraw.Draw(out).text((x+10,y+10),str(i+1)+" "+label,font=font,fill="#161616")
  if b is None:ImageDraw.Draw(out).text((x+10,y+80),"NOT AVAILABLE: "+err,font=font,fill="#990000")
dest=Path("rental/assets/product-image-audit")
dest.mkdir(parents=True,exist_ok=True)
out.save(dest/"alternate-photo-preview.jpg","JPEG",quality=80)
(dest/"alternate-photo-preview.jpg.b64").write_text(base64.b64encode((dest/"alternate-photo-preview.jpg").read_bytes()).decode("ascii"))
print("Preview images saved")
