"""Checks NTA-hosted paper addresses that other public pages link to and that are not yet in content/pyq/index.json.

Each address was seen on the page named beside it; none is constructed. Each is fetched once from NTA with an honest
client name, its page count and text are read, one inner page is put on a contact sheet for a person to look at, and the
downloaded file is deleted. Writes D:/tmp/pyq/new/ (facts.json, sheets) and nta-new-candidates.csv beside this script.
Run:  python research/cuet-pyq-2024-2026/check_new_nta.py
"""
import csv, io, json, os, re, subprocess, time
import pypdf
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(os.environ.get('PYQ_WORK', 'D:/tmp/pyq'), 'new')
os.makedirs(OUT, exist_ok=True)
UA = 'cuet-prep-inventory/0.1 (builds a link inventory of public pages; automated)'
BASE = 'https://nta.ac.in/Download/ExamPaper/'
PW = 'https://www.pw.live/cuet/exams/cuet-previous-year-question-papers'
SCI = 'https://www.sciastra.com/exams/cuet/cuet-question-paper'
VSI = 'https://www.vsijaipur.com/cuet-question-paper/'

CANDIDATES = [  # (file name, year the page gives, subject the page gives, page it was seen on)
    ('Paper_20260827151938.pdf', 2026, 'English', PW), ('Paper_20260827152118.pdf', 2026, 'Hindi', PW), ('Paper_20260827153216.pdf', 2026, 'Accountancy', PW),
    ('Paper_20260827153438.pdf', 2026, 'Biology', PW), ('Paper_20260827153549.pdf', 2026, 'Business Studies', PW), ('Paper_20260827153628.pdf', 2026, 'Chemistry', PW),
    ('Paper_20260827153953.pdf', 2026, 'Economics', PW), ('Paper_20260827154157.pdf', 2026, 'Geography', PW), ('Paper_20260827154247.pdf', 2026, 'History', PW),
    ('Paper_20260827154627.pdf', 2026, 'Mathematics', PW), ('Paper_20260827154911.pdf', 2026, 'Physics', PW), ('Paper_20260827155005.pdf', 2026, 'Political Science', PW),
    ('Paper_20260827155100.pdf', 2026, 'Psychology', PW), ('Paper_20260827155607.pdf', 2026, 'Sociology', PW), ('Paper_20260827155654.pdf', 2026, 'General Test', PW),
    ('Paper_20240930154943.pdf', 2024, 'Home Science', PW),
    ('Paper_20250728134455.pdf', 2025, 'Psychology', SCI), ('Paper_20250728135132.pdf', 2025, 'Home Science', SCI), ('Paper_20250728135455.pdf', 2025, 'Environmental Science', SCI),
    ('Paper_20250728135608.pdf', 2025, 'Computer Science', SCI), ('Paper_20250728135905.pdf', 2025, 'Anthropology', SCI), ('Paper_20250728140222.pdf', 2025, 'Urdu', SCI),
    ('Paper_20250728140325.pdf', 2025, 'Telugu', SCI), ('Paper_20250728140420.pdf', 2025, 'Tamil', SCI), ('Paper_20250728140503.pdf', 2025, 'Punjabi', SCI),
    ('Paper_20250728144504.pdf', 2025, 'Odia', SCI), ('Paper_20250728144702.pdf', 2025, 'Marathi', SCI), ('Paper_20250728144750.pdf', 2025, 'Malayalam', SCI),
    ('Paper_20250728144821.pdf', 2025, 'Kannada', SCI), ('Paper_20250728144942.pdf', 2025, 'Hindi', SCI), ('Paper_20250728145038.pdf', 2025, 'Gujarati', SCI),
    ('Paper_20250728145153.pdf', 2025, 'Bengali', SCI), ('Paper_20250728145222.pdf', 2025, 'Assamese', SCI),
    ('111620248285.pdf', 2024, 'Bengali', VSI), ('111620248309.pdf', 2024, 'Environmental Studies', VSI), ('111620247851.pdf', 2024, 'Hindi', VSI), ('111620248232.pdf', 2024, 'Sociology', VSI),
    ('Paper_20240930155738.pdf', 2024, 'Computer Science and Informatics Practices', VSI), ('Paper_20240930155843.pdf', 2024, 'Performing Arts', VSI), ('Paper_20240930155914.pdf', 2024, 'Psychology', VSI),
    ('Paper_20240930155942.pdf', 2024, 'Punjabi', VSI), ('Paper_20240930160018.pdf', 2024, 'Spanish', VSI), ('Paper_20240930154126.pdf', 2024, 'Urdu', VSI), ('Paper_20240930155013.pdf', 2024, 'History', VSI),
    ('111620247694.pdf', 2024, 'Chemistry', VSI), ('111620248031.pdf', 2024, 'Geography', VSI), ('111620247855.pdf', 2024, 'Mathematics', VSI), ('111620248079.pdf', 2024, 'Physical Education', VSI),
    ('111620248179.pdf', 2024, 'Political Science', VSI),
]
SCRIPTS = [('Devanagari', 0x0900, 0x097F), ('Bengali/Assamese', 0x0980, 0x09FF), ('Gurmukhi', 0x0A00, 0x0A7F), ('Gujarati', 0x0A80, 0x0AFF), ('Odia', 0x0B00, 0x0B7F), ('Tamil', 0x0B80, 0x0BFF), ('Telugu', 0x0C00, 0x0C7F),
           ('Kannada', 0x0C80, 0x0CFF), ('Malayalam', 0x0D00, 0x0D7F), ('Arabic/Urdu', 0x0600, 0x06FF)]
known = {d['fileUrl'] for d in json.load(open(os.path.join(ROOT, 'content', 'pyq', 'index.json'), encoding='utf8'))['documents']}
rows, tiles = [], []
for name, year, subject, seen in CANDIDATES:
    url = BASE + name
    row = {'file_url': url, 'year_given_by_page': year, 'subject_given_by_page': subject, 'seen_on': seen, 'already_in_index': 'yes' if url in known else 'no'}
    path = os.path.join(OUT, name)
    code = subprocess.run(['curl', '-s', '-L', '-m', '240', '-A', UA, '-o', path, '-w', '%{http_code}', url], capture_output=True, text=True).stdout.strip()
    time.sleep(1.0)
    row['http_status'] = code
    try:
        head = open(path, 'rb').read(5)
        if code != '200' or head != b'%PDF-':
            raise ValueError('not a PDF file')
        rd = pypdf.PdfReader(path)
        row['bytes'] = os.path.getsize(path)
        row['pages'] = len(rd.pages)
        row['pdf_title'] = str((rd.metadata or {}).get('/Title') or '')[:90]
        text = ''
        for p in rd.pages:
            try:
                text += (p.extract_text() or '') + '\n'
            except Exception:
                pass
        latin = sum(1 for ch in text if ch.isascii() and ch.isalpha())
        found = {}
        for ch in text:
            for n, lo, hi in SCRIPTS:
                if lo <= ord(ch) <= hi:
                    found[n] = found.get(n, 0) + 1
        row['latin_letters'] = latin
        row['other_scripts'] = json.dumps(found, ensure_ascii=False)
        row['first_text'] = re.sub(r'\s+', ' ', text)[:260]
        m = re.search(r'printed in ([A-Z][a-z]+(?: and [A-Z][a-z]+)?)', text)
        row['printed_in'] = m.group(1) if m else ''
        best = None
        for pn in (1, 2, 0):
            if pn < len(rd.pages):
                for im in rd.pages[pn].images:
                    if best is None or len(im.data) > len(best):
                        best = im.data
                if best and len(best) > 6000:
                    break
        row['opens'] = 'yes'
        if best:
            tiles.append((name, f'{year} {subject}', Image.open(io.BytesIO(best)).convert('RGB')))
    except Exception as e:
        row['opens'] = 'no: ' + str(e)[:80]
    try:
        os.remove(path)
    except OSError:
        pass
    rows.append(row)
    print(name, code, row.get('pages'), row.get('opens'), flush=True)

W, H, COLS, ROWS = 520, 430, 3, 4
for s in range(0, len(tiles), COLS * ROWS):
    sheet = Image.new('RGB', (W * COLS, H * ROWS), 'white')
    draw = ImageDraw.Draw(sheet)
    for i, (name, label, img) in enumerate(tiles[s:s + COLS * ROWS]):
        x, y = (i % COLS) * W, (i // COLS) * H
        img = img.crop((0, 0, img.width, min(img.height, int(img.width * 0.72))))
        img.thumbnail((W - 12, H - 34))
        sheet.paste(img, (x + 6, y + 28))
        draw.rectangle([x, y, x + W - 1, y + H - 1], outline='black')
        draw.text((x + 6, y + 6), f'#{s + i + 1}  {label[:40]}  {name[-14:]}', fill='red')
        next(r for r in rows if r['file_url'].endswith(name))['tile'] = s + i + 1
    sheet.save(os.path.join(OUT, f'sheet_{s // (COLS * ROWS) + 1:02d}.png'))
fields = ['file_url', 'year_given_by_page', 'subject_given_by_page', 'seen_on', 'already_in_index', 'http_status', 'opens', 'pages', 'bytes', 'pdf_title', 'latin_letters', 'other_scripts', 'printed_in', 'first_text', 'tile']
with open(os.path.join(HERE, 'nta-new-candidates.csv'), 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
    w.writeheader()
    w.writerows(rows)
json.dump(rows, open(os.path.join(OUT, 'facts.json'), 'w', encoding='utf8'), indent=1, ensure_ascii=False)
print('checked', len(rows), '| open', sum(r['opens'] == 'yes' for r in rows), '| sheets', (len(tiles) + 11) // 12)
