#!/usr/bin/env python3
"""One-time, narrow migration of Woongbi public SEO URLs after HTTPS activation.

Only changes the public-facing GitHub Pages hostname in site HTML, sitemaps,
robots directives, page-generation scripts, and the SEO checker/tests.
Does not change pricing, product data, private credentials or external endpoints.
"""
from pathlib import Path
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OLD_HOST = "woongbts.github.io"
NEW_HOST = "woongbts.kr"
OLD_ORIGIN = "https://" + OLD_HOST
NEW_ORIGIN = "https://" + NEW_HOST

SITEMAPS = ("sitemap.xml", "rental/sitemap.xml", "rental/food-disposer-sitemap.xml")
PYTHON_SOURCES = (
    ".github/scripts/update_sitemap.py",
    "scripts/build-rental-product-routes.py",
    "scripts/build-rental-category-pages.py",
    "scripts/seo-health-check.py",
    "scripts/test-seo-health-check.py",
)
OTHER_FILES = ("robots.txt",) + SITEMAPS


def update(path: Path, old: str, new: str) -> bool:
    text = path.read_text(encoding="utf-8")
    if old not in text:
        return False
    path.write_text(text.replace(old, new), encoding="utf-8")
    print("UPDATED", path.relative_to(ROOT))
    return True


def check_sitemap(name: str) -> int:
    sitemap = ROOT / name
    ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    parsed = ET.parse(sitemap)
    checked = 0
    for entry in parsed.getroot().iter(ns + "url"):
        loc = (entry.findtext(ns + "loc") or "").strip()
        if not loc.startswith(NEW_ORIGIN + "/"):
            raise RuntimeError(f"Unexpected URL in {name}: {loc}")
        if OLD_HOST in loc:
            raise RuntimeError(f"Stale hostname in {name}: {loc}")
        checked += 1
    return checked


def main():
    html_files = sorted(ROOT.rglob("*.html"))
    html_files = [p for p in html_files if ".git" not in p.parts]
    if len(html_files) < 500:
        raise RuntimeError("Expected 500+ static HTML pages; aborting incomplete migration")
    modified = 0
    for path in html_files:
        modified += update(path, OLD_ORIGIN, NEW_ORIGIN)
    for name in OTHER_FILES:
        modified += update(ROOT / name, OLD_ORIGIN, NEW_ORIGIN)
    for name in PYTHON_SOURCES:
        modified += update(ROOT / name, OLD_HOST, NEW_HOST)

    counts = {name: check_sitemap(name) for name in SITEMAPS}
    print("Sitemap URL counts:", counts)
    if counts["sitemap.xml"] < 400 or counts["rental/sitemap.xml"] < 400:
        raise RuntimeError("Unexpected sitemap size; aborting")
    if modified < 500:
        raise RuntimeError(f"Only {modified} files updated; expected 500+")
    for critical in ("index.html", "rates.html", "manduk-mobile.html", "rental/index.html"):
        source = (ROOT / critical).read_text(encoding="utf-8")
        if OLD_ORIGIN in source or f'canonical" href="{NEW_ORIGIN}' not in source:
            raise RuntimeError(f"Critical canonical not migrated: {critical}")

    print(f"Domain migration updated {modified} files across {len(html_files)} HTML pages")
    print("Validating static SEO health ...")
    subprocess.run(
        [sys.executable, "scripts/seo-health-check.py"],
        cwd=ROOT,
        env=__import__("os").environ | {"SEO_REPORT_PATH": "/tmp/woongbi-domain-seo.json"},
        check=True,
    )
    print("Migration checks completed")


if __name__ == "__main__":
    main()
