"""
Second verification pass over results.json (adds fields; downloads nothing):
 - reads the subject and code printed on pages 1-2 of each question paper (several booklet layouts), so identity does not rest on the listing alone;
 - decides which listing-derived documents are real answer keys and which are only notices announcing a display on the candidate portal;
 - compares mirrored key files (nta.ac.in copy and government-store copy) by their full text, so one document is stored once.
Usage: python postprocess.py results.json
"""
import json, re, subprocess, sys

path = sys.argv[1]
doc = json.load(open(path, encoding='utf-8'))
rs = doc['results']

def text(file, first=1, last=2):
    try:
        return subprocess.run(['pdftotext', '-f', str(first), '-l', str(last), file, '-'], capture_output=True, text=True, encoding='utf-8', errors='ignore', timeout=300).stdout or ''
    except Exception:
        return ''

PATTERNS = [
    re.compile(r'Subject\s*:\s*([A-Za-z0-9 /,&()\-\.]+?)\s+(?:Test Booklet Code\s+)?Code\s*:\s*(\d{3})'),
    re.compile(r'Code\s*:\s*(\d{3})\b'),
]
for r in rs:
    if r['origin'] != 'index' or r['kind'] != 'QUESTION_PAPER' or not r.get('file') or r.get('printedCode'):
        continue
    t = re.sub(r'\s+', ' ', text(r['file']))
    if len(t.strip()) < 30:
        r['textLayer'] = False
        continue
    r['textLayer'] = True
    m = PATTERNS[0].search(t)
    if m:
        r['printedSubject'], r['printedCode'] = m.group(1).strip(), m.group(2)
        continue
    m = PATTERNS[1].search(t)
    if m:
        r['printedCode'] = m.group(1)


# Recorded-response layout ("Question Paper Name : ... Subject Name : ... Creation Date ..."): the first page prints the paper name, date and shift.
MONTHS = {m: i + 1 for i, m in enumerate(['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'])}
LAYOUT = re.compile(r'Show Progress Bar\s*:?\s*(.+?)\s+(\d{1,2})(?:st|nd|rd|th)\s+([A-Za-z]+)\s+(\d{4})\s+Shift\s*(\d)')
def words(x): return set(re.findall(r'[a-z]{4,}', x.lower())) - {'and', 'with', 'applied'}
for r in rs:
    if r['origin'] != 'index' or r['kind'] != 'QUESTION_PAPER' or not r.get('file') or r.get('printedCode') or r.get('textLayer') is False:
        continue
    t = re.sub(r'\s+', ' ', text(r['file']))
    m = LAYOUT.search(t)
    if not m:
        continue
    name, day, month, year, shift = m.groups()
    r['printedSubject'] = name.strip()
    if month.lower() in MONTHS:
        r['printedDate'] = f"{year}-{MONTHS[month.lower()]:02d}-{int(day):02d}"
    r['printedShift'] = f'Shift {shift}'
    r['printedNameMatches'] = bool(words(name) & words(r.get('subjectName') or ''))

# Which listing documents are keys. A real key has thousands of rows of answers (hundreds of pages); a notice is 1-5 pages.
TITLES = {
    'Notice_20230629125445': 'CUET (UG) 2023: Provisional Answer Key (all subjects)',
    'Notice_20230712192121': 'CUET (UG) 2023: Answer Key, revised (the file’s first page says “Final Answer Key”)',
    'Notice_20240725154536': 'CUET (UG) 2024: Final Answer Keys for the OMR-based test',
    'Notice_20250701201050': 'CUET (UG) 2025: Final Answer Keys (NTA notice-board copy)',
    'Notice_20260621191633': 'CUET (UG) 2026: Final Answer Keys (NTA notice-board copy)',
}
for r in rs:
    if r['origin'] != 'listing' or r.get('duplicateOf'):
        continue
    stem = re.search(r'(Notice_\d+)', r['url'])
    stem = stem.group(1) if stem else ''
    pages = r.get('pages') or 0
    r['classifyAs'] = 'ANSWER_KEY' if pages >= 50 else 'NOTICE'
    if stem in TITLES:
        r['titleOverride'] = TITLES[stem]
    if r['classifyAs'] == 'NOTICE':
        r['noticeNote'] = 'A notice announcing that provisional keys and question papers with recorded responses were displayed on the candidate portal. It is not the key itself.'

# mirrors: compare the full text of each new key with the key already recorded for the same year
by_year = {}
for r in rs:
    if r['origin'] == 'index' and r['kind'] == 'ANSWER_KEY' and r.get('file'):
        by_year.setdefault(r['year'], []).append(r)
for r in rs:
    if r.get('classifyAs') != 'ANSWER_KEY' or not r.get('file'):
        continue
    for other in by_year.get(r['year'], []):
        import collections
        a = collections.Counter(text(other['file'], 1, 9999).split())
        b = collections.Counter(text(r['file'], 1, 9999).split())
        overlap = sum((a & b).values()) / max(1, max(sum(a.values()), sum(b.values())))
        r['textOverlapWith'] = {'url': other['url'], 'overlap': round(overlap, 4)}
        if overlap >= 0.9995:
            r['mirrorOf'] = other['url']
            r['classifyAs'] = 'MIRROR'
        else:
            r['differsFrom'] = other['url']
json.dump(doc, open(path, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('keys:', [(r['year'], r['classifyAs'], r.get('mirrorOf', '')[-24:], r['url'][-26:]) for r in rs if r.get('classifyAs') in ('ANSWER_KEY', 'MIRROR')])
print('notices:', sum(1 for r in rs if r.get('classifyAs') == 'NOTICE'))
q = [r for r in rs if r['origin'] == 'index' and r['kind'] == 'QUESTION_PAPER' and not r.get('duplicateOf')]
print('identity by printed name/date/shift:', sum(1 for r in q if r.get('printedNameMatches')), '| name does not match:', [(r['subjectCode'], r.get('printedSubject')) for r in q if r.get('printedSubject') and r.get('printedNameMatches') is False])
print('papers:', len(q), '| code printed:', sum(1 for r in q if r.get('printedCode')), '| code mismatches:', [(r['subjectCode'], r['printedCode']) for r in q if r.get('printedCode') and r.get('subjectCode') and r['printedCode'] != r['subjectCode']], '| no text layer:', sum(1 for r in q if r.get('textLayer') is False))
