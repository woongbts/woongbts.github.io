import asyncio,re,json
from playwright.async_api import async_playwright

URL="https://m.clvrental777.com/model/compare.php?model_idx=8081&ca_id=010"
KEYWORDS=["렌탈사","LG 헬로","LG헬로","스마트","BS","딜라이브","모스트","렌티스","렌타나","스카이라이프","파이브스타","유버스","캐리어","이니","세스코","개월"]

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True)
        page=await browser.new_page(viewport={"width":1280,"height":1600})
        responses=[]
        page.on("response", lambda r: responses.append((r.status,r.url)))
        await page.goto(URL,wait_until="domcontentloaded",timeout=30000)
        await page.wait_for_timeout(6000)
        text=await page.locator("body").inner_text()
        print("=== BODY START ===")
        print(text[:20000])
        print("=== BODY END ===")
        print("=== MATCHED LINES ===")
        for line in text.splitlines():
            s=line.strip()
            if s and any(k.lower() in s.lower() for k in KEYWORDS):
                print(s[:1000])
        print("=== RESPONSES ===")
        for status,url in responses:
            if any(x in url.lower() for x in ["ajax","model","rent","price","compare","api"]):
                print(status,url)
        html=await page.content()
        print("=== HTML KEY SNIPPETS ===")
        for pat in ["렌탈사","rent","company","compare","price","8081"]:
            i=html.lower().find(pat.lower())
            if i>=0:
                print("\nPAT",pat,"\n",html[max(0,i-1000):i+5000])
        await browser.close()

asyncio.run(main())
