"""Adds to content/pyq/index.json the papers found beyond AglaSem:

1. NTA's own CUET (UG) question-paper files on nta.ac.in for 2024 and 2025. NTA has no index page for them; their
   addresses are listed on Oswal Publishers' public pages. Each file is opened and its first page read, so the
   subject, date and shift recorded are the ones NTA printed, not the ones a third-party page claims.
2. SelfStudys' paper pages for 2024 and 2025, many with an exam date and shift. Each paper opens on SelfStudys' own page.
3. Adda247's memory-based papers for 2025 (date and shift in the file name). Adda247's robots rules ask automated
   clients not to fetch its PDF files, so these links are recorded but not machine-checked.

Same rules as build_index.py: public pages only, one request a second, honest client name, robots rules respected,
no login or registration wall worked around, no file kept.
Run after build_index.py:  python research/cuet-pyq-2024-2026/build_extra.py
"""
import html, json, os, re, subprocess, time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
WORK = os.environ.get('PYQ_WORK', 'D:/tmp/pyq')
UA = 'cuet-prep-inventory/0.1 (builds a link inventory of public pages; automated)'
ORIGIN = 'https://cuet.example'
TODAY = time.strftime('%Y-%m-%d')
INDEX = os.path.join(ROOT, 'content', 'pyq', 'index.json')
index = json.load(open(INDEX, encoding='utf8'))
index['documents'] = [d for d in index['documents'] if d['sourceSite'] in ('AglaSem',) or d['key'].startswith('nta:final-key:')]


def fetch(url, name, force=False):
    out = os.path.join(WORK, name)
    if not force and os.path.exists(out) and os.path.getsize(out) > 2000:
        return out
    subprocess.run(['curl', '-s', '-L', '-m', '180', '-A', UA, '-o', out, url])
    time.sleep(1.0)
    return out


def text(x):
    return html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', x))).strip()


def probe(url, ranged=True):
    hdr, body = os.path.join(WORK, 'probe.hdr'), os.path.join(WORK, 'probe.bin')
    cmd = ['curl', '-s', '-L', '-m', '60', '-A', UA, '-H', f'Origin: {ORIGIN}', '-D', hdr, '-o', body, url]
    if ranged:
        cmd[7:7] = ['-H', 'Range: bytes=0-15']
    subprocess.run(cmd)
    time.sleep(1.0)
    h = open(hdr, encoding='latin1').read() if os.path.exists(hdr) else ''
    blocks = [b for b in re.split(r'\r?\n\r?\n', h) if b.startswith('HTTP/')]
    last = blocks[-1] if blocks else ''
    status = int(re.search(r'HTTP/\S+ (\d+)', last).group(1)) if last else 0
    size = re.search(r'content-range:\s*bytes \d+-\d+/(\d+)', last, re.I)
    acao = re.search(r'access-control-allow-origin:\s*(\S+)', last, re.I)
    return {'status': status, 'is_pdf': open(body, 'rb').read(8).startswith(b'%PDF') if os.path.exists(body) else False, 'bytes': int(size.group(1)) if size else None,
            'cross_origin': bool(acao and acao.group(1) in ('*', ORIGIN)), 'frame_blocked': bool(re.search(r'x-frame-options|frame-ancestors', last, re.I))}


official = {}
for y in (2024, 2025, 2026):
    d = json.load(open(os.path.join(ROOT, 'content', 'official-papers', 'directory', f'CUET_UG-{y}.json'), encoding='utf8'))
    official[y] = {}
    for s in d['sessions']:
        official[y].setdefault(s['subjectCode'], s['subjectName'])
norm = lambda s: re.sub(r'[^a-z]', '', s.lower().replace('&', 'and'))
ALIAS = {'maths': 'mathematics', 'math': 'mathematics', 'appliedmaths': 'mathematics', 'appliedmathematics': 'mathematics', 'gat': 'general', 'generaltest': 'general', 'generalaptitudetest': 'general', 'bst': 'businessstudies',
         'eco': 'economics', 'polsci': 'politicalscience', 'accounts': 'accountancy', 'quant': 'general', 'gatlogicalreasoning': 'general', 'gatquant': 'general', 'computerscience': 'computerscience', 'informaticspractices': 'computerscience',
         'geographygeology': 'geography', 'massmedia': 'massmedia', 'environmentalstudies': 'environmental', 'environmentalscience': 'environmental', 'physicaleducation': 'physicaleducation', 'legalstudies': 'legalstudies',
         'knowledgetraditionandpracticesofindia': 'knowledgetradition', 'ktpi': 'ktpi', 'biologybiologicalstudiesbiotechnologybiochemistry': 'biology', 'entrepreneurship': 'entrepreneurship'}
slug = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def subject(year, label):
    want = ALIAS.get(norm(label), norm(label))
    if not want:
        return None
    hits = {(c, n) for c, n in official.get(year, {}).items() if norm(n).startswith(want) or norm(n).startswith('core' + want)}
    names = {n for _, n in hits}
    return sorted(hits)[0] if len(names) == 1 else None


def section_of(name, code):
    if code and code.startswith('1'):
        return 'LANGUAGE'
    return 'GENERAL' if 'general' in norm(name) else 'DOMAIN'


def record(**k):
    base = {'exam': 'CUET_UG', 'examDate': None, 'shift': None, 'language': None, 'pages': None, 'bytes': None, 'official': False, 'sourceClaim': None, 'checkedOn': TODAY, 'alternatives': [], 'embeddable': False, 'documentPageUrl': None, 'listedAs': None}
    base.update(k)
    hit = subject(base['year'], base.pop('subjectLabel'))
    name = hit[1] if hit else base.pop('fallbackName')
    base.pop('fallbackName', None)
    base.update({'subjectCode': hit[0] if hit else None, 'subjectName': name, 'subjectSlug': slug(name), 'section': section_of(name, hit[0] if hit else None)})
    return base


MONTH = {m: i + 1 for i, m in enumerate(['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'])}
MONTH.update({k[:3]: v for k, v in list(MONTH.items())})


def date_in(s, year=None):
    m = re.search(r'(\d{1,2})(?:st|nd|rd|th)?[\s.\-/]+([A-Za-z]{3,9})[\s.\-/,]+(\d{4})', s) or (re.search(r'(\d{1,2})(?:st|nd|rd|th)?[\s.\-/]+([A-Za-z]{3,9})\b', s) if year else None)
    if m and m.group(2).lower() in MONTH:
        y = int(m.group(3)) if m.lastindex >= 3 else year
        return f'{y:04d}-{MONTH[m.group(2).lower()]:02d}-{int(m.group(1)):02d}'
    m = re.search(r'(\d{1,2})[./-](\d{1,2})[./-](\d{4})', s)
    return f'{int(m.group(3)):04d}-{int(m.group(2)):02d}-{int(m.group(1)):02d}' if m else None


def shift_in(s):
    m = re.search(r'shift[\s\-:]*([1-4][AB]?|i{1,3}|first|second|third)\b', s, re.I)
    if not m:
        return None
    v = m.group(1).upper() if m.group(1)[0].isdigit() else m.group(1).lower()
    return 'Shift ' + {'i': '1', 'ii': '2', 'iii': '3', 'first': '1', 'second': '2', 'third': '3'}.get(v, v)


extra = []
report = {}

# ---------------------------------------------------------------- 1. NTA's own paper files, addresses from Oswal Publishers' pages
OSWAL = ['accountancy', 'biology', 'business-studies', 'chemistry', 'economics', 'english', 'general-test', 'geography', 'history', 'maths', 'physics', 'political-science']
OSWAL_PAGES = [f'https://oswalpublishers.com/cuet/cuet-ug-{s}-question-papers/' for s in OSWAL] + ['https://oswalpublishers.com/cuet/cuet-ug-humanities-previous-year-question-papers/', 'https://oswalpublishers.com/cuet/cuet-ug-commerce-previous-year-question-papers/']
nta = {}
for page in OSWAL_PAGES:
    s = open(fetch(page, 'osw_' + re.sub(r'[^a-z]', '_', page.split('/cuet/')[1]) + '.html'), encoding='utf8', errors='replace').read()
    heading = None
    for m in re.finditer(r'<h[2-4][^>]*>(.*?)</h[2-4]>|<tr.*?</tr>', s, re.S):
        if m.group(1) is not None:
            heading = text(m.group(1))
            continue
        row = m.group(0)
        link = re.search(r'href="(https://(?:www\.)?nta\.ac\.in/Download/ExamPaper/[^"]+\.pdf)"', row)
        if not link:
            continue
        label = text(re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.S)[0])
        url = link.group(1).replace('https://www.nta.ac.in', 'https://nta.ac.in')
        year = re.search(r'\b(20\d\d)\b', label) or re.search(r'\b(20\d\d)\b', heading or '')
        nta.setdefault(url, []).append({'label': label, 'heading': heading, 'year': int(year.group(1)) if year else None, 'page': page})
print('NTA paper files named on Oswal pages:', len(nta), flush=True)
try:
    import pypdf
except Exception:
    pypdf = None
kept = 0


def exam_year(name, meta_title):
    """Which exam a file belongs to, from NTA's own file name and the title inside the file."""
    if name.startswith('11162024'):
        return 2024, None, None  # the 2024 pen-and-paper test booklets
    if name.startswith('Paper_202507'):
        return 2025, None, None  # released in July 2025, after the 2025 exam
    m = re.search(r'(\d{1,2})\s*(May|June|July)\s*Shift\s*(\d)', meta_title or '', re.I)
    if name.startswith('Paper_202409') and m:
        return 2024, f'2024-{MONTH[m.group(2).lower()]:02d}-{int(m.group(1)):02d}', f'Shift {m.group(3)}'  # the 2024 re-test, named in the file's own title
    return None, None, None


def clean_label(label):
    x = re.sub(r'CUET|\bUG\b|20\d\d|previous year|question papers?|\bPDF\b|shift\s*\d', ' ', label, flags=re.I)
    x = re.sub(r'\s+', ' ', x).strip(' -')
    return x.title() if x.islower() or x.isupper() else x


for url, claims in nta.items():
    name = url.rsplit('/', 1)[1].replace('.pdf', '')
    if not (name.startswith('11162024') or name.startswith('Paper_202507') or name.startswith('Paper_202409')):
        continue  # files for the 2022 and 2023 exams
    f = fetch(url, 'nta_' + name + '.pdf')
    b = open(f, 'rb').read() if os.path.exists(f) else b''
    first, pages, meta_title = '', None, ''
    if pypdf and b[:4] == b'%PDF':
        try:
            rd = pypdf.PdfReader(f)
            pages = len(rd.pages)
            meta_title = str((rd.metadata or {}).get('/Title') or '')
            first = re.sub(r'\s+', ' ', rd.pages[0].extract_text() or '')[:2500]
        except Exception as e:
            first = f'(could not read: {str(e)[:60]})'
    year, date, shift = exam_year(name, meta_title)
    if year is None:
        continue
    c = probe(url)
    working = c['status'] in (200, 206) and c['is_pdf']
    labels = sorted({clean_label(x['label']) for x in claims if x['year'] in (year, None)} or {clean_label(x['label']) for x in claims}, key=len)
    label = next((l for l in labels if l), 'Unknown subject')
    booklet = re.match(r'\s*([A-D]) Test Booklet', first)
    medium = re.search(r'questions? printed in ([A-Z][a-z]+(?: and [A-Z][a-z]+)?)', first)
    language = medium.group(1).replace(' and ', ' + ') if medium else ('English' if booklet else None)
    what = ('NTA\'s pen-and-paper test booklet' + (f', booklet code {booklet.group(1)}' if booklet else '') + (f', printed in {medium.group(1)}' if medium else '') + '. ') if booklet else \
           ('The file\'s own title names the re-test of 19 July 2024, Shift 1. ' if date else 'NTA\'s released paper; its pages are images of the questions. ')
    rec = record(key='nta:paper:' + name, kind='QUESTION_PAPER', year=year, subjectLabel=label, fallbackName=label, title=f'CUET (UG) {year} question paper: {label}', sourceSite='NTA', sourcePageUrl=claims[0]['page'], fileUrl=url, fileHost='nta.ac.in',
                 pages=pages, bytes=c['bytes'] or len(b) or None, examDate=date, shift=shift, language=language, working=working, httpStatus=c['status'], embeddable=bool(working and c['cross_origin'] and not c['frame_blocked']),
                 official=True, classification='OFFICIAL', listedAs='; '.join(sorted({x['label'] for x in claims}))[:280],
                 note='NTA\'s own file, on NTA\'s website. ' + what + 'The file prints no subject heading: the subject is the one given on Oswal Publishers\' page, where this address was found. NTA has no index page for these files.')
    rec['inspection'] = {'firstPageText': first[:300], 'metaTitle': meta_title[:120], 'listedOn': sorted({x['page'] for x in claims}), 'labels': sorted({x['label'] for x in claims})}
    extra.append(rec)
    kept += 1
    try:
        os.remove(f)
    except OSError:
        pass
report['nta'] = {'files_named': len(nta), 'for_2024_2026': kept, 'working': sum(1 for r in extra if r['working'])}
print('NTA', report['nta'], flush=True)

# ---------------------------------------------------------------- 2. SelfStudys paper pages
ss = 0
for year, page in ((2025, 'https://www.selfstudys.com/books/cuet-previous-year-paper/english/year-wise/2025/57145'), (2024, 'https://www.selfstudys.com/books/cuet-previous-year-paper/english/year-wise/2024/49222')):
    s = open(fetch(page, f'ss_list_{year}.html'), encoding='utf8', errors='replace').read()
    seen = set()
    for href, label in re.findall(r'<a[^>]+href="((?:https://www\.selfstudys\.com)?/books/cuet-previous-year-paper/english/year-wise/\d{4}/[a-z0-9\-]+/\d+)"[^>]*>(.*?)</a>', s, re.S):
        if href.startswith('/'):
            href = 'https://www.selfstudys.com' + href
        label = re.sub(r'^\d+\s+', '', text(label))
        if href in seen or len(label) < 8:
            continue
        seen.add(href)
        # "CUET UG (GAT) - 20 May 2025 Shift 1", "CUET UG - General Test - 2025", "CUET (UG) - Accountancy - 17 May 2024 - Shift - 2B"
        rest = re.sub(r'^CUET\s*\(?UG\)?\s*', '', label).strip()
        par = re.match(r'\(([^)]+)\)', rest)
        subj = par.group(1).strip() if par else next((x.strip() for x in rest.split(' - ') if x.strip()), label)
        hdr = os.path.join(WORK, 'probe.hdr')
        subprocess.run(['curl', '-s', '-L', '-m', '40', '-A', UA, '-o', os.devnull, '-D', hdr, href])
        time.sleep(1.0)
        st = re.findall(r'HTTP/\S+ (\d+)', open(hdr, encoding='latin1').read())
        status = int(st[-1]) if st else 0
        extra.append(record(key='selfstudys:' + href.rsplit('/', 1)[1], kind='QUESTION_PAPER', year=year, subjectLabel=subj, fallbackName=subj, title=label, sourceSite='SelfStudys', sourcePageUrl=page, documentPageUrl=href, fileUrl=href,
                            fileHost='www.selfstudys.com', examDate=date_in(label), shift=shift_in(label), working=status == 200, httpStatus=status, classification='THIRD_PARTY_COPY', listedAs=label,
                            sourceClaim='The source titles it "NTA CUET Previous Year Paper"',
                            note='Shown on SelfStudys\' own page. Not NTA\'s original file. The date and shift are the ones SelfStudys states.' if date_in(label) else 'Shown on SelfStudys\' own page. Not NTA\'s original file. The source does not state the exam date or shift.'))
        ss += 1
report['selfstudys'] = {'listed': ss, 'pages_answering': sum(1 for r in extra if r['sourceSite'] == 'SelfStudys' and r['working'])}
print('SelfStudys', report['selfstudys'], flush=True)

# ---------------------------------------------------------------- 3. Adda247 memory-based papers, 2025 (links not machine-checked: robots rule)
page = 'https://www.adda247.com/school/cuet-ug-question-paper-2025-subject-wise-exam-analysis'
s = open(fetch(page, 'adda_2025.html'), encoding='utf8', errors='replace').read()
ad = 0
skipped_docx = 0
seen = set()
for href in re.findall(r'href="(https://www\.adda247\.com/jobs/wp-content/uploads/[^"]+\.(?:pdf|docx))"', s):
    if href in seen:
        continue
    seen.add(href)
    if href.endswith('.docx'):
        skipped_docx += 1
        continue
    name = href.rsplit('/', 1)[1].replace('.pdf', '')
    words = re.sub(r'CUET|UG|MBT|Memory|Based|Test|2025|Shift|\d+(st|nd|rd|th)?|May|June|-', ' ', name, flags=re.I)
    subj = re.sub(r'\s+', ' ', words).strip() or 'General'
    extra.append(record(key='adda247:' + name.lower(), kind='QUESTION_PAPER', year=2025, subjectLabel=subj, fallbackName=subj, title=f'CUET (UG) 2025 memory-based paper: {name.replace("-", " ")}', sourceSite='Adda247', sourcePageUrl=page, fileUrl=href,
                        fileHost='www.adda247.com', examDate=date_in(name.replace('-', ' '), 2025), shift=shift_in(name.replace('-', ' ')), working=False, httpStatus=-1, classification='MEMORY_BASED', listedAs=name,
                        sourceClaim='The source calls it memory-based, prepared from students\' recollections',
                        note='Memory-based: questions as students remembered them, written up by Adda247. Not an actual exam paper. This link was not checked automatically, because Adda247\'s robots rules ask automated clients not to fetch its PDF files.'))
    ad += 1
report['adda247'] = {'pdf_links': ad, 'word_files_left_out': skipped_docx}
print('Adda247', report['adda247'], flush=True)

index['documents'] += extra
replaced = 0
for o in [d for d in extra if d['sourceSite'] == 'NTA' and d['working']]:
    for cp in index['documents']:
        # AglaSem's copy is NTA's file with a one- or two-page cover added.
        if cp['sourceSite'] == 'AglaSem' and cp['kind'] == 'QUESTION_PAPER' and cp['year'] == o['year'] and cp['subjectSlug'] == o['subjectSlug'] and not cp.get('replacedBy') and cp['pages'] and o['pages'] and cp['pages'] - o['pages'] in (1, 2):
            cp['replacedBy'] = o['key']
            o['alternatives'].append({'site': cp['sourceSite'], 'url': cp['documentPageUrl'], 'title': cp['title']})
            replaced += 1
            break
report['aglasem_copies_of_nta_files'] = replaced
have = {s['site'] for s in index['sources']}
for src in [
    {'site': 'Oswal Publishers', 'status': 'READ', 'pages': OSWAL_PAGES, 'embedding': None, 'reason': 'Used only to find the addresses of NTA\'s own paper files; none of its own files is listed.'},
    {'site': 'SelfStudys', 'status': 'READ', 'pages': ['https://www.selfstudys.com/books/cuet-previous-year-paper/english/year-wise/2025/57145', 'https://www.selfstudys.com/books/cuet-previous-year-paper/english/year-wise/2024/49222'], 'embedding': 'Papers open on SelfStudys\' own page. Its "Download PDF" asks for sign-up, so no file address is used.'},
    {'site': 'Adda247', 'status': 'LISTED_NOT_CHECKED', 'pages': [page], 'embedding': None, 'reason': 'Robots rules disallow automated fetching of its PDF files, so links are recorded but not machine-checked. Word files were left out.'},
    {'site': 'CollegeDunia (files)', 'status': 'BLOCKED', 'pages': ['https://collegedunia.com/exams/cuet/question-paper-2026'], 'embedding': None, 'reason': 'Its file host answers, but the pages that list the files answer 403, and file names carry a hash, so papers cannot be listed without working around the block.'},
    {'site': 'Prepp', 'status': 'BLOCKED', 'pages': ['https://prepp.in/'], 'embedding': None, 'reason': 'Answers 403 to automated clients.'},
]:
    if src['site'] not in have:
        index['sources'].append(src)
index['report'] = report
json.dump(index, open(INDEX, 'w', encoding='utf8', newline='\n'), indent=1, ensure_ascii=False)
shown = [d for d in index['documents'] if not d.get('replacedBy') and (d['working'] or d['httpStatus'] == -1)]
print('TOTAL documents', len(index['documents']), '| shown', len(shown), '| checked working', sum(d['working'] for d in shown), '| not machine-checked', sum(d['httpStatus'] == -1 for d in shown))
for y in (2024, 2025, 2026):
    ps = [d for d in shown if d['kind'] == 'QUESTION_PAPER' and d['year'] == y]
    print(y, 'papers', len(ps), {s: sum(d['sourceSite'] == s for d in ps) for s in sorted({d['sourceSite'] for d in ps})}, '| with date', sum(bool(d['examDate']) for d in ps), '| subjects', len({d['subjectSlug'] for d in ps}))
print('NTA files:', [(d['year'], d['subjectName'], d['examDate'], d['shift'], d['language'], d['pages']) for d in extra if d['sourceSite'] == 'NTA'])
print('copies replaced by NTA originals:', replaced)
print('unmatched subjects:', sorted({(d['sourceSite'], d['year'], d['subjectName']) for d in extra if not d['subjectCode']})[:60])
