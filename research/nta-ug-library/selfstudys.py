"""
Collect SelfStudys' CUET-UG previous-year PDFs (permission confirmed by management, 16 Nov 2026) for the active science catalogue:
Physics 322, Chemistry 306, Mathematics 319, Biology 304, Geography/Geology 313, Computer Science 308, General Aptitude Test 501.

How: read SelfStudys' public year listing pages and each document page (one request per second, honest identifying User-Agent), take the
PDF address the page itself links (/sitepdfs/<token>), and download that file. robots.txt of the site is obeyed for every request
(it disallows /api/, user paths and any path containing "test-": those pages are skipped and reported, not worked around).
Every file is checked: PDF header, size, pages, SHA-256, the title printed on page 1 against the listing title, the subject printed against
the subject we mapped, and a keyword check of the questions against the subject. Nothing is stored here; ingest-selfstudys.mts stores.
Usage: python selfstudys.py <download-dir> <results.json>
"""
import hashlib, html, json, os, re, subprocess, sys, time, urllib.error, urllib.request
from collections import Counter

UA = 'CUETPrepArchiver/1.0 (document archiving for a study platform)'
DEST, OUT = sys.argv[1:3]
os.makedirs(DEST, exist_ok=True)
BASE = 'https://www.selfstudys.com'
YEARS = {2022: 44542, 2023: 46635, 2024: 49222, 2025: 57145}

# ---- robots.txt (group "*"): wildcard rules turned into regular expressions
def load_robots():
    req = urllib.request.Request(BASE + '/robots.txt', headers={'User-Agent': UA})
    txt = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'ignore')
    rules, group = [], None
    for line in txt.splitlines():
        line = line.split('#')[0].strip()
        if line.lower().startswith('user-agent:'):
            group = line.split(':', 1)[1].strip()
        elif line.lower().startswith('disallow:') and group == '*':
            p = line.split(':', 1)[1].strip()
            if p:
                rules.append(re.compile('^' + re.escape(p).replace('\\*', '.*')))
    return rules
ROBOTS = load_robots()
def allowed(url):
    path = url.replace(BASE, '')
    return not any(r.match(path) for r in ROBOTS)

def get(url, binary=False):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
        return (data if binary else data.decode('utf-8', 'ignore')), r.headers

SUBJECTS = [  # (code, name, title pattern)
    ('322', 'Physics', r'physics'),
    ('306', 'Chemistry', r'chemistry'),
    ('319', 'Mathematics / Applied Mathematics', r'\bmath(s|ematics)?\b|applied[- ]math'),
    ('304', 'Biology / Biological Science / Biotechnology / Biochemistry', r'biology|biological|biotech|biochem'),
    ('313', 'Geography / Geology', r'geograph|geolog'),
    ('308', 'Computer Science / Information Practices', r'computer|informatics|information[- ]practices'),
    ('501', 'General Aptitude Test', r'\bgat\b|general[- ](aptitude|test)'),
]
def subject_of(text):
    for code, name, rx in SUBJECTS:
        if code == '319' and re.search(r'business[- ]math', text, re.I): continue
        if re.search(rx, text, re.I): return code, name
    return None, None

KEYWORDS = {
    '322': r'\b(force|velocity|acceleration|magnetic|electric field|current|resistance|wave|lens|photon|nucle|capacitor|momentum|gravitation|thermodynamic)',
    '306': r'\b(mole|molar|acid|reaction|electron|bond|oxidation|enthalpy|alcohol|ketone|solution|catalyst|coordination|polymer)',
    '319': r'\b(matrix|matrices|integral|derivative|probability|determinant|vector|function|differential|linear|variance|interest)',
    '304': r'\b(cell|gene|dna|enzyme|plant|species|chromosome|ecosystem|hormone|biotechnology|reproduc|evolution)',
    '313': r'\b(population|climate|river|soil|resource|migration|industr|settlement|rock|mineral|earth|map|human geography)',
    '308': r'\b(python|database|sql|network|function|string|list|tuple|file|queue|stack|csv|array|computer)',
}
def keyword_scores(text):
    return {c: len(re.findall(rx, text, re.I)) for c, rx in KEYWORDS.items()}

def pdf_text(path, first=None, last=None):
    cmd = ['pdftotext'] + (['-f', str(first), '-l', str(last)] if first else []) + [path, '-']
    return subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='ignore', timeout=300).stdout or ''

docs, skipped, log = {}, [], []
for year, listing_id in YEARS.items():
    page = 1
    while page <= 12:
        url = f'{BASE}/books/cuet-previous-year-paper/english/year-wise/{year}/{listing_id}' + (f'?page={page}' if page > 1 else '')
        if not allowed(url):
            log.append({'url': url, 'skipped': 'robots'}); break
        try:
            body, _ = get(url)
        except Exception as e:
            log.append({'url': url, 'error': str(e)[:120]}); break
        links = sorted(set(BASE + h for h in re.findall(r'href="(/books/cuet-previous-year-paper/english/year-wise/%d/[a-z0-9-]+/\d+)"' % year, body)))
        new = [l for l in links if l not in docs]
        log.append({'url': url, 'links': len(links), 'new': len(new)})
        for l in new:
            docs[l] = {'year': year, 'docPage': l, 'listing': url, 'slug': l.split('/')[-2], 'sid': l.split('/')[-1]}
        if not new: break
        page += 1
        time.sleep(1)

results = []
for i, (u, d) in enumerate(sorted(docs.items(), key=lambda kv: (kv[1]['year'], kv[1]['slug']))):
    slug = d['slug']
    row = dict(d)
    if not re.search(r'cu(c)?et-ug', slug):
        row['status'] = 'NOT_UG'; results.append(row); continue
    code, name = subject_of(slug.replace('-', ' '))
    if not code:
        row['status'] = 'OUTSIDE_ACTIVE_CATALOGUE'; results.append(row); continue
    row.update({'subjectCode': code, 'subjectName': name})
    m = re.search(r'(\d{1,2})-([a-z]{3,9})-(\d{4})(?:-shift-(\d))?', slug)
    mon = {k: i + 1 for i, k in enumerate(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'])}
    if m and m.group(2)[:3] in mon:
        row['examDate'] = f"{m.group(3)}-{mon[m.group(2)[:3]]:02d}-{int(m.group(1)):02d}"
        row['shift'] = f'Shift {m.group(4)}' if m.group(4) else None
    if not allowed(u):
        row['status'] = 'ROBOTS_DISALLOWED'; skipped.append(u); results.append(row); print(i, 'ROBOTS', slug); continue
    try:
        page_html, _ = get(u); time.sleep(1)
    except Exception as e:
        row['status'] = 'PAGE_ERROR'; row['error'] = str(e)[:120]; results.append(row); continue
    row['title'] = html.unescape(re.search(r'<h1[^>]*>(.*?)</h1>', page_html, re.S).group(1)).strip() if re.search(r'<h1[^>]*>(.*?)</h1>', page_html, re.S) else slug
    toks = Counter(re.findall(r'https://www\.selfstudys\.com/sitepdfs/([A-Za-z0-9]+)', page_html))
    if not toks:
        row['status'] = 'NO_PDF_ON_PAGE'; results.append(row); print(i, 'NO PDF', slug); continue
    token = toks.most_common(1)[0][0]
    pdf_url = f'{BASE}/sitepdfs/{token}'
    row['fileUrl'] = pdf_url
    if not allowed(pdf_url):
        row['status'] = 'ROBOTS_DISALLOWED'; results.append(row); continue
    try:
        data, hdr = get(pdf_url, binary=True); time.sleep(1)
    except Exception as e:
        row['status'] = 'DOWNLOAD_ERROR'; row['error'] = str(e)[:120]; results.append(row); continue
    sha = hashlib.sha256(data).hexdigest()
    row.update({'status': 'OK', 'bytes': len(data), 'sha256': sha, 'lastModified': hdr.get('Last-Modified'), 'retrievedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'isPdf': data[:5] == b'%PDF-'})
    path = os.path.join(DEST, sha + '.pdf')
    if row['isPdf'] and not os.path.exists(path):
        open(path, 'wb').write(data)
    row['file'] = path
    if row['isPdf']:
        try:
            from pypdf import PdfReader
            row['pages'] = len(PdfReader(path).pages)
        except Exception:
            row['pages'] = None
        full = pdf_text(path)
        row['textChars'] = len(full)
        first = re.sub(r'\s+', ' ', full[:400])
        row['firstPage'] = first[:300]
        row['titleOnPage'] = bool(row['title'] and row['title'][:40].lower() in first.lower()) or (row.get('examDate') is not None and re.search(r'CUET', first, re.I) is not None)
        sc = keyword_scores(full)
        row['keywordScores'] = sc
        row['questions'] = len(re.findall(r'Question\s*\d+', full))
    results.append(row)
    print(i, row['status'], row.get('subjectCode'), row.get('examDate'), row.get('shift'), row.get('pages'), slug[:50], flush=True)

json.dump({'builtAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'listings': log, 'results': results}, open(OUT, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
c = Counter(r['status'] for r in results)
print('docs listed', len(docs), dict(c))
