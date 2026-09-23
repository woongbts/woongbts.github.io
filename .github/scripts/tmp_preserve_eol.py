from pathlib import Path
import difflib
import subprocess

PATHS = [
    '.github/crm/src/worker.js',
    '.github/crm/src/consent-public.js',
    '.github/crm/wrangler.consent.toml',
    '.github/crm/web/index.html',
    '.github/crm/web/app.js',
    'assets/analytics-config.js',
    'index.html',
    'rates.html',
    'links.html',
    'privacy.html',
]


def split(raw):
    lines = raw.decode('utf-8').splitlines(keepends=True)
    bodies = [line.rstrip('\r\n') for line in lines]
    endings = [line[len(body):] for line, body in zip(lines, bodies)]
    return lines, bodies, endings


for path in PATHS:
    current = Path(path).read_bytes()
    try:
        original = subprocess.check_output(['git', 'show', f'HEAD:{path}'])
    except subprocess.CalledProcessError:
        continue
    original_lines, original_bodies, _ = split(original)
    current_lines, current_bodies, current_endings = split(current)
    matcher = difflib.SequenceMatcher(None, original_bodies, current_bodies, autojunk=False)
    output = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            output.extend(original_lines[i1:i2])
        else:
            for body, ending in zip(current_bodies[j1:j2], current_endings[j1:j2]):
                output.append(body + ('\n' if ending else ''))
    Path(path).write_bytes(''.join(output).encode('utf-8'))
