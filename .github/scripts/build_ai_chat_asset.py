"""Keep the deployed AI chat asset in sync with its readable source."""
from pathlib import Path
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
source = (root / 'src/ai-chat.js').read_text(encoding='utf-8').rstrip() + '\n'
target = root / 'assets/ai-chat.min.js'
if args.check:
    if target.read_text(encoding='utf-8').rstrip() + '\n' != source:
        raise SystemExit('AI chat source and deployed asset differ')
    print('AI chat source/asset parity OK')
else:
    target.write_text(source, encoding='utf-8')
    print('AI chat asset rebuilt')
