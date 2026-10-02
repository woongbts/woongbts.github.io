#!/usr/bin/env python3
import json,re,ssl
from html import unescape
from pathlib import Path
from urllib.parse import urljoin,urlparse
from urllib.request import Request,urlopen

BASE="https://woongbi.vip-rental.com/"
HOST="woongbi.vip-rental.com"
UA="Mozilla/5.0 (compatible; WoongbiRentalProbe/1.0)"
OUT=Path(".github/tmp/clover-probe.json")
SEEDS=[
 BASE,
 urljoin(BASE,"categ/1091"),
 urljoin(BASE,"categ/1059/1912"),
 urljoin(BASE,"categ/1059/2261"),
 urljoin(BASE,"categ/1068/1599"),
 urljoin(BASE,"categ/1069/2096"),
]

def fetch(url):
    req=Request(url,headers={"User-Agent":UA,"Accept-Language":"ko-KR,ko;q=0.9"})
    ctx=ssl._create_unverified_context() if urlparse(url).netloc==HOST else None
    with urlopen(req,timeout=15,context=ctx) as r:
        return r.read().decode(r.headers.get_content_charset() or "utf-8","replace")

def main():
    pages=[]; scripts=set()
    for url in SEEDS:
        try: html=fetch(url)
        except Exception as e:
            pages.append({"url":url,"error":str(e)}); continue
        srcs=[urljoin(url,unescape(x)) for x in re.findall(r'<script[^>]+src=["\']([^"\']+)["\']',html,re.I)]
        scripts.update(x for x in srcs if urlparse(x).netloc==HOST)
        refs=sorted(set(unescape(x) for x in re.findall(r'["\']([^"\']*(?:categ/|api|board|item|goods|product)[^"\']*)["\']',html,re.I)))
        pages.append({"url":url,"length":len(html),"scripts":srcs,"refs":refs[:1000]})
    script_info=[]
    for src in sorted(scripts):
        try: js=fetch(src)
        except Exception as e:
            script_info.append({"url":src,"error":str(e)}); continue
        refs=sorted(set(unescape(x) for x in re.findall(r'["\']([^"\']*(?:categ/|api|board|item|goods|product)[^"\']*)["\']',js,re.I)))
        snippets=[]
        if "vshop" in src:
            for pat in ["load_board.php","axios.get","getDatas","pageNum","categ=","categ2=","m_id"]:
                start=0
                while True:
                    i=js.find(pat,start)
                    if i<0: break
                    snippets.append({"pattern":pat,"text":js[max(0,i-550):min(len(js),i+950)]})
                    start=i+len(pat)
                    if sum(1 for s in snippets if s["pattern"]==pat)>=8: break
        script_info.append({"url":src,"length":len(js),"refs":refs[:2000],"snippets":snippets[:80]})
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps({"pages":pages,"scripts":script_info},ensure_ascii=False,indent=2),encoding="utf-8")
if __name__=="__main__": main()
