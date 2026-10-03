#!/usr/bin/env python3
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

SAMPLES=[
 ("clv-8081","https://m.clvrental777.com/model/compare.php?model_idx=8081&ca_id=010"),
 ("clv-58159","https://m.clvrental777.com/model/compare.php?model_idx=58159&ca_id=043"),
 ("clv-36320","https://m.clvrental777.com/model/compare.php?model_idx=36320&ca_id=043"),
]
OUT=Path("rental/data/clover-detail-diagnostic.json")

async def main():
    rows=[]
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(headless=True)
        for pid,url in SAMPLES:
            page=await browser.new_page(viewport={"width":1280,"height":1100})
            try:
                await page.goto(url,wait_until="domcontentloaded",timeout=30000)
                await page.wait_for_timeout(2500)
                text=await page.locator("body").inner_text()
                rows.append({"id":pid,"url":url,"body":text[:30000]})
            except Exception as e:
                rows.append({"id":pid,"url":url,"error":repr(e)})
            finally:
                await page.close()
        await browser.close()
    OUT.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

if __name__=="__main__":
    asyncio.run(main())
