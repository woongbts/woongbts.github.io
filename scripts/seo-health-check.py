#!/usr/bin/env python3
"""Read-only SEO quality guard. Traffic optimization requires separate Search Console authorization."""
import datetime as dt
import json
import os
from html.parser import HTMLParser
from pathlib import Path
import sys
from urllib.parse import urlsplit, unquote
import xml.etree.ElementTree as ET

SITE = 'https://woongbts.github.io'
ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
SITEMAPS = ('sitemap.xml', 'rental/sitemap.xml', 'rental/food-disposer-sitemap.xml')
CRITICAL = ('index.html', 'rates.html', 'rental/index.html')
errors, warnings = [], []
scanned = set()
urls_seen = 0

class Head(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ''
        self.meta = {}
        self.canonical = ''
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        props = dict(attrs)
        if tag == 'title':
            self.in_title = True
        if tag == 'meta' and props.get('name'):
            self.meta[props['name'].lower()] = props.get('content', '')
        if tag == 'link' and 'canonical' in props.get('rel', '').lower().split():
            self.canonical = props.get('href', '')

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data

def audit_page(location):
    url = urlsplit(location)
    if url.scheme != 'https' or url.netloc != 'woongbts.github.io' or url.query or url.fragment:
        errors.append('External/noncanonical sitemap address: ' + location)
        return
    path = unquote(url.path)
    if path.startswith('/rental/product/') and path.endswith('/'):
        # Virtual product URLs are served by the existing rental product router.
        return
    relative = path.lstrip('/')
    if not relative or relative.endswith('/'):
        relative += 'index.html'
    if relative in scanned:
        return
    scanned.add(relative)
    physical = ROOT / relative
    if not physical.is_file():
        errors.append('Sitemap target missing: ' + relative)
        return
    doc = physical.read_text(encoding='utf-8')
    head = Head()
    try:
        head.feed(doc)
    except Exception as exc:
        errors.append(f'Invalid HTML head in {relative}: {exc}')
        return
    if not head.title.strip():
        errors.append('Missing title: ' + relative)
    if not head.meta.get('description', '').strip():
        warnings.append('Missing description: ' + relative)
    if 'noindex' in head.meta.get('robots', '').lower():
        errors.append('Noindex page listed in sitemap: ' + relative)
    if head.canonical != location:
        errors.append(f'Wrong canonical: {relative}: {head.canonical or "(missing)"}')
    if relative in CRITICAL:
        for script in ('analytics-config.js', 'conversion-tracker.min.js', 'site-analytics.min.js'):
            if '/assets/' + script not in doc:
                warnings.append(f'First-party analytics hook missing ({script}): {relative}')

def audit_sitemap(file):
    global urls_seen
    path = ROOT / file
    if not path.is_file():
        errors.append('Sitemap missing: ' + file)
        return
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as exc:
        errors.append(f'Invalid sitemap {file}: {exc}')
        return
    ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    if root.tag != '{http://www.sitemaps.org/schemas/sitemap/0.9}urlset':
        errors.append('Incorrect sitemap root: ' + file)
        return
    seen = set()
    for entry in root.findall('s:url', ns):
        loc = (entry.findtext('s:loc', default='', namespaces=ns) or '').strip()
        if not loc:
            errors.append('Empty sitemap URL in ' + file)
            continue
        if loc in seen:
            errors.append('Duplicate sitemap URL in ' + file + ': ' + loc)
            continue
        seen.add(loc)
        urls_seen += 1
        modified = (entry.findtext('s:lastmod', default='', namespaces=ns) or '').strip()
        if modified:
            try:
                stamp = dt.date.fromisoformat(modified[:10])
                if stamp > dt.date.today() + dt.timedelta(days=1):
                    errors.append('Future sitemap lastmod: ' + loc)
            except ValueError:
                errors.append('Invalid sitemap lastmod: ' + loc)
        audit_page(loc)

def main():
    robots = ROOT / 'robots.txt'
    if not robots.is_file():
        errors.append('robots.txt missing')
    else:
        txt = robots.read_text(encoding='utf-8')
        for sitemap in ('sitemap.xml', 'rental/food-disposer-sitemap.xml'):
            if SITE + '/' + sitemap not in txt:
                errors.append('Robots sitemap declaration missing: ' + sitemap)
    for sitemap in SITEMAPS:
        audit_sitemap(sitemap)
    if (ROOT / 'index.html').is_file():
        home = (ROOT / 'index.html').read_text(encoding='utf-8')
        if 'naver-site-verification' not in home:
            warnings.append('Naver site verification meta missing from home')
    result = {
        'status': 'fail' if errors else 'pass',
        'static_pages_checked': len(scanned),
        'sitemap_url_entries': urls_seen,
        'errors': errors,
        'warnings': warnings,
        'note': 'Technical SEO audit only; live rankings, traffic and conversions are not queried.'
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a', encoding='utf-8') as output:
            output.write('## 웅비통신 SEO 정기 점검\n\n')
            output.write(f'- 결과: **{result["status"].upper()}**\n')
            output.write(f'- 사이트맵 URL: {urls_seen}, 확인한 정적 페이지: {len(scanned)}\n')
            output.write(f'- 오류: {len(errors)}, 참고사항: {len(warnings)}\n')
            for label, messages in (('오류', errors), ('참고', warnings)):
                if messages:
                    output.write('\n### ' + label + '\n')
                    for message in messages[:30]:
                        output.write('- ' + message.replace('\n', ' ') + '\n')
    return 1 if errors else 0

if __name__ == '__main__':
    raise SystemExit(main())
