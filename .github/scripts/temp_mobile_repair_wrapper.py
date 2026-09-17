from pathlib import Path

path=Path('.github/scripts/temp_mobile_repair.py')
src=path.read_text(encoding='utf-8')
old='''for i, url in enumerate(urls, 1):
    home = replace_once(home, '<article class="deal-card">', f'<article class="deal-card" data-calculator-url="{url}">', f"card {i} route")
for i, url in enumerate(urls, 1):
    home = replace_once(home, '<a class="deal-link" href="/rates.html">내 조건으로 다시 계산 →</a>', f'<a class="deal-link" href="{url}">내 조건으로 다시 계산 →</a>', f"card {i} link")
'''
new='''for i, url in enumerate(urls, 1):
    old_card = '<article class="deal-card">'
    if old_card not in home:
        raise SystemExit(f"card {i} route: source card not found")
    home = home.replace(old_card, f'<article class="deal-card" data-calculator-url="{url}">', 1)
for i, url in enumerate(urls, 1):
    old_link = '<a class="deal-link" href="/rates.html">내 조건으로 다시 계산 →</a>'
    if old_link not in home:
        raise SystemExit(f"card {i} link: source link not found")
    home = home.replace(old_link, f'<a class="deal-link" href="{url}">내 조건으로 다시 계산 →</a>', 1)
'''
if old not in src:
    raise SystemExit('homepage sequence block not found in repair script')
src=src.replace(old,new,1)
exec(compile(src,str(path),'exec'),{'__name__':'__main__'})
