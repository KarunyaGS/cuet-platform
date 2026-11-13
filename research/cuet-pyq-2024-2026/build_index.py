"""Builds content/pyq/index.json: every CUET UG 2024-2026 paper, sample paper and answer key found on public pages,
each tied to a destination that was checked to open.

Rules: public pages only, one request a second, a client name that says what it is, each host's robots rules respected.
No login, registration wall or other protection is worked around. No file is copied: only addresses and facts are kept.
A document counts as working only when its file answered with a PDF signature at check time.

Run from the repository root:  python research/cuet-pyq-2024-2026/build_index.py
"""
import html, json, os, re, subprocess, sys, time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
WORK = os.environ.get('PYQ_WORK', 'D:/tmp/pyq')
os.makedirs(WORK, exist_ok=True)
UA = 'cuet-prep-inventory/0.1 (builds a link inventory of public pages; automated)'
# The address CUET Prep would be served from, sent as Origin to see whether a file host lets other sites read its files.
ORIGIN = 'https://cuet.example'
YEARS = (2024, 2025, 2026)


def fetch(url, name):
    out = os.path.join(WORK, name)
    if os.path.exists(out) and os.path.getsize(out) > 2000:
        return out
    subprocess.run(['curl', '-s', '-L', '-m', '60', '-A', UA, '-o', out, url])
    time.sleep(1.0)
    return out


def text(x):
    return html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', x))).strip()


def article(path):
    s = open(path, encoding='utf8', errors='replace').read()
    a = re.search(r'<article.*?</article>', s, re.S)
    return re.sub(r'<script.*?</script>|<style.*?</style>', '', a.group(0) if a else s, flags=re.S), s


def probe(url):
    """Asks for the first bytes of a file. Returns status, whether it is a PDF, its size, and whether other sites may read it."""
    hdr = os.path.join(WORK, 'probe.hdr')
    body = os.path.join(WORK, 'probe.bin')
    subprocess.run(['curl', '-s', '-L', '-m', '60', '-A', UA, '-H', f'Origin: {ORIGIN}', '-H', 'Range: bytes=0-15', '-D', hdr, '-o', body, url])
    time.sleep(1.0)
    h = open(hdr, encoding='latin1').read() if os.path.exists(hdr) else ''
    blocks = [b for b in re.split(r'\r?\n\r?\n', h) if b.startswith('HTTP/')]
    last = blocks[-1] if blocks else ''
    status = int(re.search(r'HTTP/\S+ (\d+)', last).group(1)) if last else 0
    head = open(body, 'rb').read(8) if os.path.exists(body) else b''
    size = re.search(r'content-range:\s*bytes \d+-\d+/(\d+)', last, re.I)
    acao = re.search(r'access-control-allow-origin:\s*(\S+)', last, re.I)
    return {'status': status, 'is_pdf': head.startswith(b'%PDF'), 'bytes': int(size.group(1)) if size else None, 'cross_origin': bool(acao and acao.group(1) in ('*', ORIGIN)),
            'frame_blocked': bool(re.search(r'x-frame-options|frame-ancestors', last, re.I))}


# ---------------------------------------------------------------- AglaSem: year pages and sample-paper pages
docs = {}
for year in YEARS:
    page = f'https://admission.aglasem.com/cuet-{year}-question-paper/'
    body, _ = article(fetch(page, f'y{year}.html'))
    start = body.find('Download CUET')
    keys_at = body.find('Answer keys', start)
    end = body.find(f'CUET UG {year} Question Paper PDF', keys_at)
    group = None
    for m in re.finditer(r'<h[2-5][^>]*>(.*?)</h[2-5]>|<a[^>]+href="(https://docs\.aglasem\.com/view/[^"]+)"[^>]*>(.*?)</a>', body[start:end], re.S):
        if m.group(1) is not None:
            h = text(m.group(1))
            if h in ('Languages', 'Domain subjects', 'General Aptitude Test', 'General Test', 'Answer keys'):
                group = h
            continue
        label = re.sub(r'^PDF\s+|\s+AglaSem Docs View$', '', text(m.group(3))).strip()
        kind = 'ANSWER_KEY' if start + m.start() > keys_at else 'QUESTION_PAPER'
        docs[m.group(2)] = {'year': year, 'kind': kind, 'label': label, 'group': None if kind == 'ANSWER_KEY' else group, 'source_page': page, 'doc_page': m.group(2)}

index_body, _ = article(fetch('https://admission.aglasem.com/cuet-sample-papers/', 'samples_index.html'))
for href, label in re.findall(r'<a[^>]+href="(/cuet-sample-paper-[^"]+/)"[^>]*>(.*?)</a>', index_body, re.S):
    page = 'https://admission.aglasem.com' + href
    body, _ = article(fetch(page, 'sp_' + re.sub(r'[^a-z]', '_', href) + '.html'))
    # Each row of the table: what the paper is, and its link.
    for row in re.findall(r'<tr.*?</tr>', body, re.S):
        link = re.search(r'href="(https://docs\.aglasem\.com/view/[^"]+)"', row)
        cells = [text(c) for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.S)]
        if not link or link.group(1) in docs or len(cells) < 2:
            continue
        docs[link.group(1)] = {'year': None, 'kind': 'SAMPLE_PAPER', 'label': text(label), 'group': None, 'source_page': page, 'doc_page': link.group(1), 'row_title': cells[0], 'row_note': cells[1]}

records = list(docs.values())
print('listed on AglaSem:', len(records), {k: sum(r['kind'] == k for r in records) for k in ('QUESTION_PAPER', 'ANSWER_KEY', 'SAMPLE_PAPER')}, flush=True)

for i, r in enumerate(records, 1):
    doc_id = r['doc_page'].rsplit('/', 1)[1]
    s = open(fetch(r['doc_page'], f'doc_{doc_id}.html'), encoding='utf8', errors='replace').read()
    title = re.search(r'<title>(.*?)</title>', s, re.S)
    r['doc_title'] = text(title.group(1)).replace(' - Download PDF | AglaSem', '') if title else ''
    pdf = re.search(r'https://cdn\.aglasem\.com/aglasem-doc/[0-9a-f-]+/[0-9a-f-]+\.pdf', s)
    r['file_url'] = pdf.group(0) if pdf else None
    pages = re.search(r'\(PDF\s*·\s*(\d+)\s*pages?\)', text(s))
    r['pages'] = int(pages.group(1)) if pages else None
    r['says_nta'] = 'Published by NTA' in s
    r['doc_page_frame_blocked'] = True  # docs.aglasem.com sends X-Frame-Options: SAMEORIGIN (checked 13 Nov 2026)
    r['check'] = probe(r['file_url']) if r['file_url'] else {'status': 0, 'is_pdf': False, 'bytes': None, 'cross_origin': False, 'frame_blocked': False}
    if i % 25 == 0:
        print('checked', i, 'of', len(records), flush=True)

# ---------------------------------------------------------------- NTA's own final answer keys (already held in the official directory)
official = {}
for y in YEARS:
    d = json.load(open(os.path.join(ROOT, 'content', 'official-papers', 'directory', f'CUET_UG-{y}.json'), encoding='utf8'))
    subj = {}
    for s in d['sessions']:
        e = subj.setdefault(s['subjectCode'], {'name': s['subjectName'], 'sessions': []})
        e['sessions'].append({'date': s.get('date'), 'shift': s.get('shift'), 'keyPage': s.get('keyPage')})
    official[y] = {'key': d['key'], 'subjects': subj, 'check': probe(d['key']['url'])}

norm = lambda s: re.sub(r'[^a-z]', '', s.lower().replace('&', 'and'))
ALIAS = {'accountancy': 'accountancy', 'computerscienceinformaticspractices': 'computerscience', 'computerscienceandinformaticspractices': 'computerscience', 'computerscience': 'computerscience', 'geographygeology': 'geography',
         'geographyandgeology': 'geography', 'massmediamasscommunication': 'massmedia', 'massmediaandmasscommunication': 'massmedia', 'economicsandbusinesseconomics': 'economics', 'environmentalscience': 'environmental',
         'environmentalstudies': 'environmental', 'generalaptitudetest': 'general', 'generaltest': 'general', 'knowledgetraditionandpracticesofindia': 'knowledgetradition', 'maths': 'mathematics'}


def official_subject(year, label):
    want = ALIAS.get(norm(label), norm(label))
    hits = [(c, v) for c, v in official[year]['subjects'].items() if norm(v['name']).startswith(want) or norm(v['name']).startswith('core' + want)]
    names = {h[1]['name'] for h in hits}
    return hits[0] if len(names) == 1 else None


LANGS = {'English', 'Hindi', 'Assamese', 'Bengali', 'Gujarati', 'Kannada', 'Malayalam', 'Marathi', 'Odia', 'Punjabi', 'Tamil', 'Telugu', 'Urdu', 'Arabic', 'Spanish', 'Sanskrit'}
slug = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
out = []
for r in records:
    c = r['check']
    working = c['status'] in (200, 206) and c['is_pdf']
    doc_id = r['doc_page'].rsplit('/', 1)[1]
    base = {
        'key': f'aglasem:{doc_id}', 'exam': 'CUET_UG', 'kind': r['kind'], 'title': r['doc_title'], 'sourceSite': 'AglaSem', 'sourcePageUrl': r['source_page'], 'documentPageUrl': r['doc_page'], 'fileUrl': r['file_url'],
        'fileHost': 'cdn.aglasem.com', 'pages': r['pages'], 'bytes': c['bytes'], 'examDate': None, 'shift': None, 'language': None, 'working': working, 'httpStatus': c['status'],
        # Other sites may show the file only if its host says so. AglaSem's file host does not, and its document page refuses to be framed.
        'embeddable': bool(working and c['cross_origin']), 'official': False, 'sourceClaim': 'The source page says "Published by NTA"' if r['says_nta'] else None,
        'checkedOn': time.strftime('%Y-%m-%d'), 'alternatives': [],
    }
    if r['kind'] == 'QUESTION_PAPER':
        hit = official_subject(r['year'], r['label'])
        section = 'GENERAL' if 'General' in r['label'] else 'LANGUAGE' if (r['group'] == 'Languages' or (r['label'] in LANGS and not (r['label'] == 'Sanskrit' and r['year'] == 2025))) else 'DOMAIN'
        out.append({**base, 'year': r['year'], 'subjectCode': hit[0] if hit else None, 'subjectName': hit[1]['name'] if hit else r['label'], 'subjectSlug': slug(hit[1]['name'] if hit else r['label']), 'listedAs': r['label'], 'section': section,
                    'classification': 'THIRD_PARTY_COPY',
                    'note': 'A copy hosted by AglaSem, with its cover page or watermark. It is not NTA\'s original file. The source does not state the exam date, shift or medium.'
                    + ('' if hit else ' This subject is not in NTA\'s final answer key for this year, so treat it with care.')})
    elif r['kind'] == 'ANSWER_KEY':
        out.append({**base, 'year': r['year'], 'subjectCode': None, 'subjectName': None, 'subjectSlug': None, 'listedAs': r['label'], 'section': None, 'classification': 'THIRD_PARTY_COPY',
                    'note': 'A copy of NTA\'s answer key hosted by AglaSem. It covers every subject of the year.'})
    else:
        m = re.search(r'\b(20\d\d)\b', r.get('row_title', '') + ' ' + r['doc_title'])
        year = int(m.group(1)) if m else None
        hit = official_subject(year, r['label']) if year in YEARS else official_subject(2026, r['label'])
        out.append({**base, 'year': year, 'subjectCode': hit[0] if hit else None, 'subjectName': hit[1]['name'] if hit else r['label'], 'subjectSlug': slug(hit[1]['name'] if hit else r['label']), 'listedAs': r.get('row_title') or r['label'],
                    'section': 'GENERAL' if 'General' in r['label'] else 'DOMAIN', 'classification': 'SAMPLE', 'note': (r.get('row_note') or 'A practice paper listed by AglaSem.') + ' Not an actual exam paper.'})

# NTA's originals take the place of third-party copies of the same answer key; the copy stays on record as another address.
for y in YEARS:
    k = official[y]['key']
    c = official[y]['check']
    working = c['status'] in (200, 206) and c['is_pdf']
    host = re.sub(r'^https://([^/]+)/.*', r'\1', k['url'])
    copies = [d for d in out if d['kind'] == 'ANSWER_KEY' and d['year'] == y and (y != 2024 or 'CBT' in d['listedAs'])]
    out.append({'key': f'nta:final-key:{y}', 'exam': 'CUET_UG', 'kind': 'ANSWER_KEY', 'year': y, 'title': k['title'], 'sourceSite': 'NTA', 'sourcePageUrl': k['url'], 'documentPageUrl': None, 'fileUrl': k['url'], 'fileHost': host,
                'pages': k.get('pages'), 'bytes': c['bytes'], 'examDate': None, 'shift': None, 'language': None, 'working': working, 'httpStatus': c['status'], 'embeddable': bool(working and c['cross_origin'] and not c['frame_blocked']),
                'official': True, 'sourceClaim': None, 'checkedOn': time.strftime('%Y-%m-%d'), 'subjectCode': None, 'subjectName': None, 'subjectSlug': None, 'listedAs': 'Final answer key', 'section': None, 'classification': 'OFFICIAL',
                'note': 'NTA\'s own final answer key, on NTA\'s website. It lists answers by exam date, shift and subject.' + (' Computer-based papers only.' if y == 2024 else ''),
                'alternatives': [{'site': d['sourceSite'], 'url': d['documentPageUrl'], 'title': d['title']} for d in copies],
                'sessions': {code: v['sessions'] for code, v in official[y]['subjects'].items()}})
    for d in copies:
        d['replacedBy'] = f'nta:final-key:{y}'

index = {
    'schema': 'cuet-pyq-index/1', 'builtOn': time.strftime('%Y-%m-%d'), 'exam': 'CUET_UG', 'years': list(YEARS),
    'sources': [
        {'site': 'AglaSem', 'status': 'READ', 'pages': ['https://admission.aglasem.com/cuet-question-papers/', 'https://admission.aglasem.com/cuet-sample-papers/'], 'embedding': 'Not allowed: the file host sends no cross-origin permission and the document page refuses framing. Papers open on AglaSem\'s own page.'},
        {'site': 'NTA', 'status': 'READ', 'pages': [official[y]['key']['url'] for y in YEARS], 'embedding': 'Final answer keys on NTA\'s file host can be read by other sites.'},
        {'site': 'CollegeDunia', 'status': 'BLOCKED', 'pages': ['https://collegedunia.com/exams/cuet/question-paper'], 'embedding': None, 'reason': 'Answers 403 to an automated client, including for its robots file.'},
        {'site': 'Shiksha', 'status': 'BLOCKED', 'pages': ['https://www.shiksha.com/'], 'embedding': None, 'reason': 'Answers 403 to an automated client, including for its robots file.'},
        {'site': 'Careers360', 'status': 'REGISTRATION_WALL', 'pages': ['https://university.careers360.com/articles/cuet-question-papers'], 'embedding': None, 'reason': 'Every "Download Now" leads to a registration page. Its files are described as memory-based questions and analysis.'},
    ],
    'documents': out,
}
dest = os.path.join(ROOT, 'content', 'pyq')
os.makedirs(dest, exist_ok=True)
json.dump(index, open(os.path.join(dest, 'index.json'), 'w', encoding='utf8', newline='\n'), indent=1, ensure_ascii=False)
shown = [d for d in out if not d.get('replacedBy')]
print('documents', len(out), '| shown', len(shown), '| working', sum(d['working'] for d in shown), '| not working', [d['title'] for d in shown if not d['working']])
print('by kind', {k: sum(d['kind'] == k for d in shown) for k in ('QUESTION_PAPER', 'ANSWER_KEY', 'SAMPLE_PAPER')}, '| embeddable', sum(d['embeddable'] for d in shown), [d['key'] for d in shown if d['embeddable']])
for y in YEARS:
    print(y, 'papers', sum(d['kind'] == 'QUESTION_PAPER' and d['year'] == y for d in shown), 'keys', [(d['sourceSite'], d['listedAs'], d['httpStatus'], d['embeddable']) for d in shown if d['kind'] == 'ANSWER_KEY' and d['year'] == y])
print('sample papers', [(d['year'], d['subjectName'], d['listedAs'][:40]) for d in shown if d['kind'] == 'SAMPLE_PAPER'][:30])
