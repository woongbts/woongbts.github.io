#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
SITEMAP = ROOT / "sitemap.xml"

TRACKED = {
    "https://woongbts.github.io/": [
        "index.html",
        "assets/site-pro.css",
        "assets/readability-20260921.css",
        "assets/ai-chat.min.js",
        "assets/analytics-config.js",
        "assets/conversion-tracker.min.js",
        "assets/site-analytics.min.js",
    ],
    "https://woongbts.github.io/rates.html": [
        "rates.html",
        "assets/rates.min.js",
        "assets/rates.css",
        "assets/conversion-tracker.min.js",
        "sw.js",
        "data/catalog.json",
        "data/plans.json",
        "data/supports.json",
        "data/mvno-postpaid.json",
        "data/prepaid.json",
        "data/internet.json",
    ],
    "https://woongbts.github.io/manduk-mobile.html": ["manduk-mobile.html"],
    "https://woongbts.github.io/links.html": ["links.html"],
    "https://woongbts.github.io/privacy.html": ["privacy.html"],
}


def latest_date(paths):
    cmd = ["git", "log", "-1", "--format=%cs", "--", *paths]
    result = subprocess.run(cmd, cwd=ROOT, check=True, text=True, capture_output=True)
    value = result.stdout.strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise SystemExit(f"Could not determine lastmod for: {paths}")
    return value


def main():
    text = SITEMAP.read_text(encoding="utf-8")
    for loc, paths in TRACKED.items():
        date = latest_date(paths)
        escaped = re.escape(loc)
        pattern = rf"(<loc>{escaped}</loc><lastmod>)\d{{4}}-\d{{2}}-\d{{2}}(</lastmod>)"
        text, count = re.subn(pattern, rf"\g<1>{date}\g<2>", text)
        if count != 1:
            raise SystemExit(f"Sitemap entry not found exactly once: {loc}")
    SITEMAP.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main()
