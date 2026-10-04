#!/usr/bin/env python3
from pathlib import Path
import html
import json
import re
import subprocess
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[2]
SITEMAP = ROOT / "sitemap.xml"
RENTAL_SITEMAP = ROOT / "rental/sitemap.xml"
PRODUCTS = ROOT / "rental/data/products.json"

STATIC = {
    "https://woongbts.github.io/": ["index.html","assets/site-pro.css","assets/readability-20260921.css","assets/ai-chat.min.js","assets/analytics-config.js","assets/conversion-tracker.min.js","assets/site-analytics.min.js"],
    "https://woongbts.github.io/rates.html": ["rates.html","assets/rates.min.js","assets/rates.css","assets/conversion-tracker.min.js","sw.js","data/catalog.json","data/plans.json","data/supports.json","data/mvno-postpaid.json","data/prepaid.json","data/internet.json"],
    "https://woongbts.github.io/manduk-mobile.html": ["manduk-mobile.html"],
    "https://woongbts.github.io/links.html": ["links.html"],
    "https://woongbts.github.io/privacy.html": ["privacy.html"],
    "https://woongbts.github.io/rental/": ["rental/index.html","rental/assets/catalog.js","rental/assets/ai-recommend.js","rental/assets/ai-recommend.css","rental/assets/rental.css","rental/data/featured.json"],
}

def latest_date(paths):
    existing=[p for p in paths if (ROOT/p).exists()]
    cmd=["git","log","-1","--format=%cs","--",*existing]
    out=subprocess.run(cmd,cwd=ROOT,check=True,text=True,capture_output=True).stdout.strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}",out):
        raise SystemExit(f"Could not determine lastmod: {paths}")
    return out

def entry(loc,lastmod,changefreq="weekly",priority="0.5"):
    return f"  <url><loc>{html.escape(loc,quote=False)}</loc><lastmod>{lastmod}</lastmod><changefreq>{changefreq}</changefreq><priority>{priority}</priority></url>"

def main():
    rows=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    priorities={
      "https://woongbts.github.io/":("weekly","1.0"),
      "https://woongbts.github.io/rates.html":("daily","0.9"),
      "https://woongbts.github.io/manduk-mobile.html":("weekly","0.8"),
      "https://woongbts.github.io/links.html":("monthly","0.5"),
      "https://woongbts.github.io/privacy.html":("yearly","0.4"),
      "https://woongbts.github.io/rental/":("daily","0.9"),
    }
    for loc,paths in STATIC.items():
      freq,prio=priorities[loc]
      rows.append(entry(loc,latest_date(paths),freq,prio))

    data=json.loads(PRODUCTS.read_text(encoding="utf-8"))
    product_date=latest_date(["rental/data/products.json","rental/data/appliance-gift-options.json","rental/product.html","rental/assets/product-generic.js"])
    products=[
      p for p in data.get("products",[])
      if p.get("availability")!="inactive" and not re.search(r"접수불가|접수중지|단종",str(p.get("name") or ""))
    ]
    for p in sorted(products,key=lambda x:str(x.get("id") or "")):
      pid=quote(str(p.get("id") or ""),safe="-_")
      if not pid: continue
      rows.append(entry(f"https://woongbts.github.io/rental/product/{pid}/",product_date,"weekly","0.6"))
    rows.append("</urlset>")
    SITEMAP.write_text("\n".join(rows)+"\n",encoding="utf-8")

    rental_rows=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    rental_rows.append(entry("https://woongbts.github.io/rental/",latest_date(STATIC["https://woongbts.github.io/rental/"]),"daily","0.9"))
    for p in sorted(products,key=lambda x:str(x.get("id") or "")):
      pid=quote(str(p.get("id") or ""),safe="-_")
      if not pid: continue
      rental_rows.append(entry(f"https://woongbts.github.io/rental/product/{pid}/",product_date,"weekly","0.6"))
    rental_rows.append("</urlset>")
    RENTAL_SITEMAP.write_text("\n".join(rental_rows)+"\n",encoding="utf-8")

if __name__=="__main__":
    main()
