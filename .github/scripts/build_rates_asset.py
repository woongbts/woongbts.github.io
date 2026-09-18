#!/usr/bin/env python3
from pathlib import Path
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("--check", action="store_true")
args = parser.parse_args()

src = Path("src/rates.js")
out = Path("assets/rates.min.js")
if not src.exists():
    raise SystemExit("src/rates.js missing")

normalize = lambda value: value.rstrip() + "\n"
source = normalize(src.read_text(encoding="utf-8"))
production = normalize(out.read_text(encoding="utf-8")) if out.exists() else ""

if args.check:
    if source != production:
        raise SystemExit("assets/rates.min.js differs from src/rates.js; edit src/rates.js first and rebuild")
    print("rates source/production parity OK")
else:
    out.write_text(source, encoding="utf-8")
    print("assets/rates.min.js rebuilt from src/rates.js")
