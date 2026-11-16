"""
Download and verify official NTA CUET-UG documents (question papers and answer keys), 2022-2026.

Targets = (a) every NTA-hosted file already recorded in the local previous-year index (classification OFFICIAL),
          (b) answer-key documents found on NTA's own listing pages by discover.py.
Rules: one request per second; honest identifying User-Agent; no login, no bypass; only NTA hosts (nta.ac.in, cuet.nta.nic.in and the
government file store cdnbbsr.s3waas.gov.in that NTA's pages link to). Every file is checked (PDF header, size, page count, SHA-256,
first-page text) and de-duplicated by hash; the original bytes are never modified.
Usage: python fetch.py <db.sqlite> <candidates.json> <download-dir> <results.json>
"""
import hashlib, json, os, re, sqlite3, subprocess, sys, time, urllib.error, urllib.request

UA = 'CUETPrepArchiver/1.0 (document archiving for a study platform)'
DB, CAND, DEST, RES = sys.argv[1:5]
ALLOWED = ('nta.ac.in', 'cuet.nta.nic.in', 'cdnbbsr.s3waas.gov.in')
os.makedirs(DEST, exist_ok=True)

targets = {}
db = sqlite3.connect('file:' + DB + '?mode=ro', uri=True)
for r in db.execute("select id,key,year,kind,subject_code,subject_name,language,exam_date,shift,file_url,source_page_url,pages,bytes,title from pyq_documents where official=1 and exam_code='CUET_UG'"):
    targets[r[9]] = {'url': r[9], 'origin': 'index', 'docId': r[0], 'key': r[1], 'year': r[2], 'kind': r[3], 'subjectCode': r[4], 'subjectName': r[5], 'language': r[6], 'examDate': r[7], 'shift': r[8], 'listedOn': r[10], 'expectedPages': r[11], 'expectedBytes': r[12], 'title': r[13]}

def year_of(u):
    m = re.search(r'Notice_(\d{4})', u) or re.search(r'/uploads/(\d{4})/', u)
    return int(m.group(1)) if m else None

cands = json.load(open(CAND, encoding='utf-8'))['candidates']
for x in cands:
    t = re.sub(r'\s+', ' ', x['text'])
    if not re.search(r'CUET|Common University Entrance', t, re.I): continue
    if re.search(r'CUET[ \-]*\(?PG|post ?graduate', t, re.I): continue
    if not re.search(r'answer key|question paper', t, re.I): continue
    u = x['url']
    if not u.startswith('https://'): u = 'https://nta.ac.in' + (u if u.startswith('/') else '/' + u)
    if u in targets: continue
    targets[u] = {'url': u, 'origin': 'listing', 'year': year_of(u), 'kind': 'NOTICE_OR_KEY', 'title': t[:300], 'listedOn': x['listing']}

def fetch(url):
    host = re.match(r'https://([^/]+)/', url).group(1)
    if host not in ALLOWED: return {'status': 'SKIPPED_HOST', 'error': host}
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            data = r.read()
            return {'status': 'OK', 'http': r.status, 'type': r.headers.get('content-type'), 'data': data, 'last_modified': r.headers.get('last-modified')}
    except urllib.error.HTTPError as e:
        return {'status': 'HTTP_ERROR', 'http': e.code}
    except Exception as e:
        return {'status': 'ERROR', 'error': str(e)[:200]}

def pages_of(path):
    try:
        from pypdf import PdfReader
        return len(PdfReader(path).pages)
    except Exception:
        return None

def first_page(path):
    try:
        return subprocess.run(['pdftotext', '-f', '1', '-l', '1', path, '-'], capture_output=True, text=True, timeout=60).stdout
    except Exception:
        return ''

results, seen = [], {}
for i, (url, t) in enumerate(sorted(targets.items(), key=lambda kv: (kv[1].get('year') or 0, kv[0]))):
    r = fetch(url)
    row = dict(t)
    row['status'] = r['status']
    if r['status'] != 'OK':
        row.update({k: v for k, v in r.items() if k != 'data'})
        results.append(row); print(i, row['status'], url[-60:]); time.sleep(1); continue
    data = r['data']
    sha = hashlib.sha256(data).hexdigest()
    row.update({'http': r['http'], 'contentType': r['type'], 'lastModified': r['last_modified'], 'bytes': len(data), 'sha256': sha, 'retrievedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())})
    row['isPdf'] = data[:5] == b'%PDF-'
    if sha in seen:
        row['duplicateOf'] = seen[sha]
        results.append(row); print(i, 'DUPLICATE', url[-50:]); time.sleep(1); continue
    seen[sha] = url
    path = os.path.join(DEST, sha + '.pdf')
    if row['isPdf']:
        open(path, 'wb').write(data)
        row['pages'] = pages_of(path)
        txt = first_page(path)
        row['firstPage'] = re.sub(r'\s+', ' ', txt)[:700]
        m = re.search(r'Subject\s*:\s*(.+?)\s+Code\s*:\s*(\d+)', txt)
        if m: row['printedSubject'], row['printedCode'] = m.group(1).strip(), m.group(2)
        mm = re.search(r'Medium\s*:\s*(.+)', txt)
        if mm: row['printedMedium'] = mm.group(1).strip()[:80]
        row['copyrightMarks'] = bool(re.search(r'copyright|©|all rights reserved|third party', txt, re.I))
        row['file'] = path
    results.append(row)
    print(i, 'OK', row.get('printedCode') or '', url[-50:])
    time.sleep(1)
json.dump({'builtAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'results': results}, open(RES, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
ok = [r for r in results if r['status'] == 'OK' and r.get('isPdf')]
print('targets', len(targets), '| downloaded ok', len(ok), '| duplicates', sum(1 for r in results if r.get('duplicateOf')), '| failed', sum(1 for r in results if r['status'] != 'OK'))
