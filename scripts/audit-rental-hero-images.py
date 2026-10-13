#!/usr/bin/env python3
"""Review actual product-cover image composition, not just missing filenames.

Diagnostic-only: never auto-replace a model with an unrelated image.
The generated contact sheets enable a human to verify product-only photos.
"""
import json
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "rental/data/products.json"
PHOTOS = ROOT / "rental/assets/product-images"
REPORT = ROOT / "rental/data/hero-image-quality-audit.json"
SHEETS = ROOT / "rental/assets/product-image-audit"
SHEETS.mkdir(parents=True, exist_ok=True)

FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 17)
SMALL = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
face_cascade = (cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")\n                if hasattr(cv2, "CascadeClassifier") and hasattr(cv2, "data") else None)

data = json.loads(CATALOG.read_text(encoding="utf-8"))
products = [
    p for p in data.get("products", [])
    if p.get("availability") != "inactive" and not re.search("접수불가|접수중지", p.get("name") or "")
]
records = []
preview = []
for index, p in enumerate(products, 1):
    pid = str(p.get("id") or "")
    filename = PHOTOS / (pid + ".webp")
    result = dict(index=index, id=pid, brand=p.get("brand"), name=p.get("name"),
                  category=p.get("category"), model=p.get("model"),
                  method=p.get("imageRepresentativeMethod"),
                  source=p.get("imageRepresentativeSource"), flags=[])
    try:
        src = Image.open(filename)
        src.load()
        src = ImageOps.exif_transpose(src).convert("RGB")
        result["dimensions"] = list(src.size)
        w, h = src.size
        if min(w,h) < 200:
            result["flags"].append("low-resolution")
        if max(w,h) / max(1, min(w,h)) > 2.5:
            result["flags"].append("banner-shape")
        npimg = np.asarray(src)
        white = np.all(npimg > 238, axis=2)
        result["lightBackgroundFraction"] = round(float(np.mean(white)), 3)
        # Face detection only suggests review; photo suitability requires context.
        face_sample = src.copy()
        face_sample.thumbnail((520,520))
        gray = cv2.cvtColor(np.asarray(face_sample),cv2.COLOR_RGB2GRAY)
        faces = face_cascade.detectMultiScale(gray,scaleFactor=1.12,minNeighbors=5,minSize=(28,28))
        result["faceCount"] = len(faces)
        if len(faces):
            result["flags"].append("people-visible")
        if result["lightBackgroundFraction"] < 0.04:
            result["flags"].append("non-studio-background")
        result["fileBytes"] = filename.stat().st_size
        thumb = ImageOps.contain(src,(165,143),Image.Resampling.LANCZOS)
    except Exception as ex:
        result["flags"].append("missing-or-corrupt")
        result["error"] = str(ex)[:140]
        thumb = Image.new("RGB",(165,143),"#ededed")
    tile = Image.new("RGB",(192,190),"white")
    tile.paste(thumb,((192-thumb.width)//2,(146-thumb.height)//2))
    draw = ImageDraw.Draw(tile)
    if result["flags"]:
        draw.rectangle((0,0,191,189),outline="#c77633",width=3)
    draw.text((6,150),f"{index:03} {pid[:15]}",font=FONT,fill="#202020")
    draw.text((6,173),str(p.get("category") or "")[:5],font=SMALL,fill="#69777a")
    preview.append(tile)
    records.append(result)

pages = []
columns, rows = 6, 8
per_sheet = columns * rows
for start in range(0,len(preview),per_sheet):
    chunk = preview[start:start+per_sheet]
    sheet = Image.new("RGB",(columns*192,rows*190),"#f2f3f3")
    for j,tile in enumerate(chunk):
        sheet.paste(tile,((j%columns)*192,(j//columns)*190))
    name = f"hero-{start//per_sheet+1:02}.jpg"
    sheet.save(SHEETS/name,"JPEG",quality=82,optimize=True)
    pages.append({"file":f"assets/product-image-audit/{name}","fromIndex":start+1,
                  "toIndex":min(start+per_sheet,len(preview))})
flags = {}
for row in records:
    for f in row["flags"]:
        flags[f] = flags.get(f,0)+1
report = {
    "generatedAt":"2026-10-13",
    "scope":"visible catalog product covers",
    "products":len(records),
    "flagCounts":flags,
    "manualReviewNeeded":sum(bool(r["flags"]) for r in records),
    "contactSheets":pages,
    "productsDetail":records
}
REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({k:v for k,v in report.items() if k!="productsDetail"},ensure_ascii=False))
