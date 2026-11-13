"""Adds the NTA originals in nta-new-candidates.csv to content/pyq/index.json as links to NTA's own files.

Addresses and facts only: nothing is downloaded, copied or hosted. Each record keeps the language that was verified, so
the student rule (English-only) decides by itself which ones students see. No existing record is changed or removed.
Safe to run again: a record is added once, by its key.

Order when rebuilding the index:  build_index.py, build_extra.py, apply_language.py, then this script.
Run:  python research/cuet-pyq-2024-2026/add_new_nta.py
"""
import csv, json, os, re
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
INDEX = os.path.join(ROOT, 'content', 'pyq', 'index.json')
index = json.load(open(INDEX, encoding='utf8'))
official = {}
for y in (2024, 2025, 2026):
    d = json.load(open(os.path.join(ROOT, 'content', 'official-papers', 'directory', f'CUET_UG-{y}.json'), encoding='utf8'))
    official[y] = {s['subjectCode']: s['subjectName'] for s in d['sessions']}
CODE = {'English': '101', 'Hindi': '102', 'Assamese': '103', 'Bengali': '104', 'Gujarati': '105', 'Kannada': '106', 'Malayalam': '107', 'Marathi': '108', 'Odia': '109', 'Punjabi': '110', 'Tamil': '111', 'Telugu': '112',
        'Urdu': '113', 'Spanish': '218', 'Accountancy': '301', 'Anthropology': '303', 'Biology': '304', 'Business Studies': '305', 'Chemistry': '306', 'Environmental Studies': '307', 'Environmental Science': '307',
        'Computer Science': '308', 'Computer Science and Informatics Practices': '308', 'Economics': '309', 'Geography': '313', 'History': '314', 'Home Science': '315', 'Mathematics': '319', 'Performing Arts': '320',
        'Physical Education': '321', 'Physics': '322', 'Political Science': '323', 'Psychology': '324', 'Sociology': '326', 'General Test': '501'}
SITE = {'www.pw.live': 'PW (Physics Wallah)', 'www.sciastra.com': 'SciAstra', 'www.vsijaipur.com': 'VSI Jaipur'}
slug = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
MONTH = {'may': 5, 'june': 6, 'july': 7}

have = {d['key'] for d in index['documents']}
urls = {d['fileUrl'] for d in index['documents']}
rows = list(csv.DictReader(open(os.path.join(HERE, 'nta-new-candidates.csv'), encoding='utf-8-sig')))
added = []
for r in rows:
    name = r['file_url'].rsplit('/', 1)[1][:-4]
    key = 'nta:paper:' + name
    if key in have or r['file_url'] in urls:
        continue
    if r['opens'] != 'yes' and not r['pages']:
        continue
    year, label = int(r['year_given_by_page']), r['subject_given_by_page']
    code = CODE[label]
    subject = official[year][code]
    host = r['seen_on'].split('/')[2]
    # The 2024 re-test files name their own session in the title inside the file. The 2026 titles repeat across subjects, so no date is taken from them.
    m = re.search(r'(\d{1,2})\s*(May|June|July)\s*Shift\s*(\d)', r['pdf_title'], re.I) if name.startswith('Paper_202409') else None
    date, shift = (f'2024-{MONTH[m.group(2).lower()]:02d}-{int(m.group(1)):02d}', f'Shift {m.group(3)}') if m else (None, None)
    booklet = name.startswith('11162024')
    what = 'NTA\'s pen-and-paper test booklet. ' if booklet else 'The file\'s own title names the re-test of 19 July 2024, Shift 1. ' if date else 'NTA\'s released paper; its pages are images of the questions. '
    language = None if r['verified_language'] == 'not verified' else r['verified_language']
    rec = {
        'exam': 'CUET_UG', 'examDate': date, 'shift': shift, 'language': language, 'pages': int(r['pages']), 'bytes': int(r['bytes']) if r['bytes'] else None, 'official': True, 'sourceClaim': None, 'checkedOn': '2026-11-13',
        'alternatives': [], 'embeddable': False, 'documentPageUrl': None, 'listedAs': label, 'key': key, 'kind': 'QUESTION_PAPER', 'year': year, 'title': f'CUET (UG) {year} question paper: {label}', 'sourceSite': 'NTA',
        'sourcePageUrl': r['seen_on'], 'fileUrl': r['file_url'], 'fileHost': 'nta.ac.in', 'working': True, 'httpStatus': int(r['http_status']), 'classification': 'OFFICIAL',
        'note': 'NTA\'s own file, on NTA\'s website. ' + what + f'The file prints no subject heading: the subject is the one given on {SITE[host]}\'s page, where this address was found. NTA has no index page for these files.',
        'subjectCode': code, 'subjectName': subject, 'subjectSlug': slug(subject), 'section': 'LANGUAGE' if code[0] in '12' else 'GENERAL' if code == '501' else 'DOMAIN',
        'inspection': {'firstPageText': r['first_text'][:300], 'metaTitle': r['pdf_title'][:120], 'listedOn': [r['seen_on']], 'labels': [label]},
        'languageBasis': r['language_basis'],
    }
    index['documents'].append(rec)
    have.add(key)
    added.append(rec)

for host, site in SITE.items():
    if not any(s['site'] == site for s in index['sources']):
        pages = sorted({r['seen_on'] for r in rows if r['seen_on'].split('/')[2] == host})
        index['sources'].append({'site': site, 'status': 'READ', 'pages': pages, 'embedding': None, 'reason': 'Used only to find the addresses of NTA\'s own paper files; none of its own files is listed.'})
nta_all = [d for d in index['documents'] if d['key'].startswith('nta:paper:')]
index['report']['nta'].update({'added_from_other_pages': sum(1 for d in nta_all if 'oswalpublishers' not in d['sourcePageUrl']), 'working': sum(1 for d in nta_all if d['working']), 'for_2024_2026': len(nta_all)})
json.dump(index, open(INDEX, 'w', encoding='utf8', newline='\n'), indent=1, ensure_ascii=False)

out = [{'year': d['year'], 'subject': d['subjectName'], 'subject_code': d['subjectCode'], 'exam_date': d['examDate'] or 'not stated', 'shift': d['shift'] or 'not stated', 'language': d['language'] or 'not verified', 'pages': d['pages'],
        'student_visible': 'yes' if d['language'] == 'English' else 'no', 'why_hidden': '' if d['language'] == 'English' else 'language not verified' if not d['language'] else 'language paper, not English' if d['section'] == 'LANGUAGE' else 'bilingual, not English-only',
        'nta_file_url': d['fileUrl'], 'found_on': d['sourcePageUrl'], 'record_key': d['key']} for d in nta_all if 'oswalpublishers' not in d['sourcePageUrl']]
out.sort(key=lambda x: (x['student_visible'] != 'yes', -x['year'], x['subject']))
with open(os.path.join(HERE, 'nta-added-records.csv'), 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.DictWriter(f, fieldnames=list(out[0].keys()))
    w.writeheader()
    w.writerows(out)
print('added now', len(added), '| NTA paper records', len(nta_all), '| documents', len(index['documents']))
print('of the added records:', Counter(x['student_visible'] for x in out), Counter(x['why_hidden'] for x in out))
for x in out:
    if x['student_visible'] == 'yes':
        print('VISIBLE', x['year'], x['subject'], x['exam_date'], x['shift'], x['pages'], x['nta_file_url'])
