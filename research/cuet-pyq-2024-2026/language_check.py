"""Gathers what is needed to verify each paper's language, without keeping any paper.

- NTA's pen-and-paper booklets have real text: every page is read and the scripts found are recorded.
- Scanned papers (NTA's computer-based papers, AglaSem's copies) have no text: one inner page image of each is fetched
  and laid out on contact sheets, so a person can look at them. AglaSem serves each page as a small picture.
- SelfStudys files its papers under its "English" section; that statement is recorded as the basis.

Writes D:/tmp/pyq/lang/ (sheets, facts.json). Downloaded PDFs are deleted. Same access rules as the other builders.
Run:  python research/cuet-pyq-2024-2026/language_check.py
"""
import io, json, os, re, subprocess, time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
WORK = os.environ.get('PYQ_WORK', 'D:/tmp/pyq')
OUT = os.path.join(WORK, 'lang')
os.makedirs(OUT, exist_ok=True)
UA = 'cuet-prep-inventory/0.1 (builds a link inventory of public pages; automated)'
import pypdf
from PIL import Image, ImageDraw

index = json.load(open(os.path.join(ROOT, 'content', 'pyq', 'index.json'), encoding='utf8'))
docs = [d for d in index['documents'] if d['kind'] in ('QUESTION_PAPER', 'SAMPLE_PAPER')]


def get(url, path):
    if not (os.path.exists(path) and os.path.getsize(path) > 500):
        subprocess.run(['curl', '-s', '-L', '-m', '180', '-A', UA, '-o', path, url])
        time.sleep(1.0)
    return path


SCRIPTS = [('Devanagari', 0x0900, 0x097F), ('Bengali/Assamese', 0x0980, 0x09FF), ('Gurmukhi', 0x0A00, 0x0A7F), ('Gujarati', 0x0A80, 0x0AFF), ('Odia', 0x0B00, 0x0B7F), ('Tamil', 0x0B80, 0x0BFF), ('Telugu', 0x0C00, 0x0C7F),
           ('Kannada', 0x0C80, 0x0CFF), ('Malayalam', 0x0D00, 0x0D7F), ('Arabic/Urdu', 0x0600, 0x06FF)]


def scripts_in(text):
    found = {}
    for ch in text:
        o = ord(ch)
        for name, lo, hi in SCRIPTS:
            if lo <= o <= hi:
                found[name] = found.get(name, 0) + 1
    latin = sum(1 for ch in text if ch.isascii() and ch.isalpha())
    return latin, found


facts = {}
tiles = []  # (key, label, image)
for d in docs:
    key = d['key']
    fact = {'title': d['title'], 'site': d['sourceSite'], 'year': d['year'], 'subject': d['subjectName'], 'section': d['section']}
    if d['sourceSite'] == 'SelfStudys':
        fact['basis'] = 'source-section'
        fact['sourceSection'] = 'english' if '/english/' in d['fileUrl'] else None
    elif d['sourceSite'] == 'Adda247':
        fact['basis'] = 'none'  # its files may not be fetched automatically, so nothing could be looked at
    elif d['sourceSite'] == 'AglaSem':
        base = d['fileUrl'].rsplit('/', 1)[0]
        img = None
        for n in (4, 3, 2):
            path = get(f'{base}/{n}.jpg', os.path.join(OUT, f"ag_{key.split(':')[1]}_{n}.jpg"))
            try:
                img = Image.open(path).convert('RGB')
                break
            except Exception:
                continue
        fact['basis'] = 'page-image' if img else 'none'
        if img:
            tiles.append((key, f"{d['year'] or ''} {d['subjectName']} [AglaSem]", img))
    elif d['sourceSite'] == 'NTA':
        path = get(d['fileUrl'], os.path.join(OUT, d['fileUrl'].rsplit('/', 1)[1]))
        try:
            rd = pypdf.PdfReader(path)
            text = ''
            for p in rd.pages:
                try:
                    text += (p.extract_text() or '') + '\n'
                except Exception:
                    pass
            latin, found = scripts_in(text)
            fact['pages'] = len(rd.pages)
            if latin > 2000:
                fact['basis'] = 'text'
                fact['latinLetters'] = latin
                fact['otherScripts'] = found
                m = re.search(r'printed in ([A-Z][a-z]+(?: and [A-Z][a-z]+)?)', text)
                fact['printedIn'] = m.group(1) if m else None
            else:
                # scanned: take the largest picture on an inner page
                best = None
                for pn in (1, 2, 0):
                    if pn < len(rd.pages):
                        for im in rd.pages[pn].images:
                            if best is None or len(im.data) > len(best):
                                best = im.data
                        if best and len(best) > 6000:
                            break
                fact['basis'] = 'page-image' if best else 'none'
                if best:
                    tiles.append((key, f"{d['year']} {d['subjectName']} [NTA]", Image.open(io.BytesIO(best)).convert('RGB')))
        except Exception as e:
            fact['basis'] = 'none'
            fact['error'] = str(e)[:100]
        try:
            os.remove(path)
        except OSError:
            pass
    facts[key] = fact

# ---- contact sheets: 12 tiles each, numbered
W, H, COLS, ROWS = 520, 430, 3, 4
sheet_of = {}
for s in range(0, len(tiles), COLS * ROWS):
    sheet = Image.new('RGB', (W * COLS, H * ROWS), 'white')
    draw = ImageDraw.Draw(sheet)
    for i, (key, label, img) in enumerate(tiles[s:s + COLS * ROWS]):
        n = s + i + 1
        x, y = (i % COLS) * W, (i // COLS) * H
        # the top part of the page, where the first question is
        img = img.crop((0, 0, img.width, min(img.height, int(img.width * 0.72))))
        img.thumbnail((W - 12, H - 34))
        sheet.paste(img, (x + 6, y + 28))
        draw.rectangle([x, y, x + W - 1, y + H - 1], outline='black')
        draw.text((x + 6, y + 6), f'#{n}  {label[:60]}', fill='red')
        facts[key]['tile'] = n
        sheet_of[n] = key
    name = os.path.join(OUT, f'sheet_{s // (COLS * ROWS) + 1:02d}.png')
    sheet.save(name)
json.dump({'facts': facts, 'tiles': sheet_of}, open(os.path.join(OUT, 'facts.json'), 'w', encoding='utf8'), indent=1, ensure_ascii=False)
from collections import Counter
print('documents', len(docs), Counter(f['basis'] for f in facts.values()), 'sheets', (len(tiles) + 11) // 12)
for k, f in facts.items():
    if f['basis'] == 'text':
        print('TEXT', f['year'], f['subject'], '| printed in:', f.get('printedIn'), '| latin', f['latinLetters'], '| other scripts', f['otherScripts'])
