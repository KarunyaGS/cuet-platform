"""Clean-PDF and rights report for every CUET (UG) 2024-2026 paper record in content/pyq/index.json.

Writes, beside this script:
  cuet-pyq-source-inventory.csv        every record: source, year, subject, date, shift, language, addresses, checks
  cuet-pyq-clean-pdf-availability.csv  one row per actual paper: is there a clean original, where, and other copies
  cuet-pyq-rights-status.csv           permission / rights status of every paper
  cuet-pyq-eligible-for-generation.csv papers that may be turned into CUET Prep PDFs today
  cuet-pyq-external-links.csv          papers that must stay links to their source
  cuet-pyq-missing.csv                 subjects and sessions with no English-only paper
Nothing is downloaded here; it reads what the collection and language checks already established.
Run:  python research/cuet-pyq-2024-2026/clean_pdf_report.py
"""
import csv, json, os
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
index = json.load(open(os.path.join(ROOT, 'content', 'pyq', 'index.json'), encoding='utf8'))
docs = index['documents']
by_key = {d['key']: d for d in docs}


def write(name, rows):
    if not rows:
        rows = [{'note': 'none'}]
    with open(os.path.join(HERE, name), 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    return len(rows)


def clean_state(d):
    """Is the file free of third-party additions?"""
    if d['sourceSite'] == 'NTA':
        return 'CLEAN_ORIGINAL', 'NTA\'s own file on NTA\'s website; nothing added by anyone else'
    if d['sourceSite'] == 'AglaSem':
        return 'THIRD_PARTY_MARKED', 'AglaSem\'s copy: its cover page and, on 2026 files, its name across every page'
    if d['sourceSite'] == 'SelfStudys':
        return 'THIRD_PARTY_REWRITTEN', 'SelfStudys\' own write-up, shown on its page with answers and solutions under each question; no direct file'
    if d['sourceSite'] == 'Adda247':
        return 'THIRD_PARTY_MEMORY_BASED', 'Adda247\'s memory-based paper; not an actual exam paper'
    return 'OWN', 'CUET Prep\'s own document'


def rights(d):
    if d['sourceSite'] == 'NTA':
        return 'NTA', 'LINK_ONLY', 'NTA\'s terms allow reproduction only after permission is taken; none is on record. NTA also asks for permission before other sites link to it.'
    if d['kind'] == 'SAMPLE_PAPER':
        return 'Not established', 'LINK_ONLY', 'No author or licence is stated.'
    if d['sourceSite'] == 'AglaSem':
        return 'NTA (questions); AglaSem (its additions)', 'LINK_ONLY', 'No permission from NTA and no licence from AglaSem on record.'
    if d['sourceSite'] == 'SelfStudys':
        return 'NTA (questions); SelfStudys (solutions and layout)', 'LINK_ONLY', 'SelfStudys reserves all rights; no permission on record.'
    return 'Adda247', 'LINK_ONLY', 'Adda247\'s own material; no permission on record.'


papers = [d for d in docs if d['kind'] in ('QUESTION_PAPER', 'SAMPLE_PAPER')]
reachable = lambda d: d['working'] or d['httpStatus'] == -1

# ---- 1. source inventory: every record
inventory = []
for d in docs:
    state, what = clean_state(d)
    owner, status, why = rights(d)
    inventory.append({
        'record_key': d['key'], 'type': d['kind'], 'source': d['sourceSite'], 'year': d['year'] or '', 'subject': d.get('subjectName') or '(all subjects)', 'subject_code': d.get('subjectCode') or '',
        'exam_date': d.get('examDate') or 'not stated', 'shift': d.get('shift') or 'not stated', 'language': d.get('language') or ('not applicable' if d['kind'] == 'ANSWER_KEY' else 'not verified'),
        'language_basis': d.get('languageBasis') or '', 'pages': d.get('pages') or '', 'opens': 'yes, checked' if d['working'] else 'link not machine-checked (site rule)' if d['httpStatus'] == -1 else 'no',
        'clean_state': state, 'what_the_file_is': what, 'content_owner': owner, 'rights_status': status, 'rights_note': why, 'same_paper_as': d.get('replacedBy') or '',
        'source_page_url': d['sourcePageUrl'], 'document_page_url': d.get('documentPageUrl') or '', 'file_url': d['fileUrl'], 'checked_on': d['checkedOn'],
    })
write('cuet-pyq-source-inventory.csv', inventory)

# ---- 2. clean-PDF availability: one row per actual paper (copies folded into the original they copy)
copies_of = {}
for d in docs:
    if d.get('replacedBy'):
        copies_of.setdefault(d['replacedBy'], []).append(d)
availability = []
for d in papers:
    if d.get('replacedBy') or not reachable(d):
        continue
    state, what = clean_state(d)
    others = copies_of.get(d['key'], [])
    english = d.get('language') == 'English'
    availability.append({
        'year': d['year'] or '', 'subject': d.get('subjectName') or '', 'subject_code': d.get('subjectCode') or '', 'type': d['kind'], 'exam_date': d.get('examDate') or 'not stated', 'shift': d.get('shift') or 'not stated',
        'language': d.get('language') or 'not verified', 'english_only': 'yes' if english else 'no',
        'clean_original_available': 'yes' if state == 'CLEAN_ORIGINAL' else 'no', 'best_available_file': d['sourceSite'], 'file_state': what, 'pages': d.get('pages') or '',
        'opens_and_is_complete': ('opens; page count read from the file' if d['sourceSite'] == 'NTA' else 'opens; page count from the source page' if d.get('pages') else 'page answers; shown by the source\'s own viewer') if d['working'] else 'link not machine-checked',
        'also_on': '; '.join(sorted({o['sourceSite'] for o in others})) or '', 'copies': len(others), 'best_url': d.get('documentPageUrl') or d['fileUrl'],
        'in_english_only_collection': 'yes' if english and d['working'] else 'no',
    })
availability.sort(key=lambda r: (-(r['year'] or 0) if isinstance(r['year'], int) else 0, r['subject'], r['exam_date']))
write('cuet-pyq-clean-pdf-availability.csv', availability)

# ---- 3. rights status of every paper
status_rows = []
for d in papers:
    owner, status, why = rights(d)
    status_rows.append({'record_key': d['key'], 'source': d['sourceSite'], 'year': d['year'] or '', 'subject': d.get('subjectName') or '', 'type': d['kind'], 'language': d.get('language') or 'not verified', 'content_owner': owner,
                        'permission_or_licence_on_record': 'None', 'rights_status': status, 'may_be_reproduced_as_cuet_prep_pdf': 'no', 'may_be_linked': 'yes, with the source named', 'note': why})
write('cuet-pyq-rights-status.csv', status_rows)

# ---- 4. eligible for CUET Prep PDF generation: only content with confirmed rights
eligible = [{'what': 'CUET Prep practice papers made from our own question bank', 'subject': 'Physics (322)', 'rights_basis': 'OWNED_ORIGINAL: written for CUET Prep and owned by it', 'questions_available': 787,
             'sets_of_50_possible': 15, 'generated_so_far': 1, 'note': 'Not previous-year papers. Each is marked "Preview: not yet reviewed" until a subject expert approves its questions.'}]
write('cuet-pyq-eligible-for-generation.csv', eligible)

# ---- 5. must remain external links
external = []
for d in papers:
    if d.get('replacedBy') or not reachable(d):
        continue
    owner, status, why = rights(d)
    english = d.get('language') == 'English'
    external.append({'year': d['year'] or '', 'subject': d.get('subjectName') or '', 'type': d['kind'], 'exam_date': d.get('examDate') or 'not stated', 'shift': d.get('shift') or 'not stated', 'language': d.get('language') or 'not verified',
                     'source_to_name': d['sourceSite'], 'open_at': d.get('documentPageUrl') or d['fileUrl'], 'why_it_stays_a_link': why,
                     'shown_to_students': 'yes' if english and d['working'] else 'no: ' + ('not English-only' if d.get('language') and not english else 'language not verified' if not d.get('language') else 'link not checked')})
write('cuet-pyq-external-links.csv', external)

# ---- 6. missing: subjects and sessions with no English-only paper
missing = []
for y in (2024, 2025, 2026):
    off = json.load(open(os.path.join(ROOT, 'content', 'official-papers', 'directory', f'CUET_UG-{y}.json'), encoding='utf8'))
    subj = {}
    for s in off['sessions']:
        subj.setdefault(s['subjectCode'], {'name': s['subjectName'], 'n': 0})['n'] += 1
    shown = [d for d in papers if d['kind'] == 'QUESTION_PAPER' and d['year'] == y and not d.get('replacedBy') and d['working']]
    for code, v in sorted(subj.items()):
        mine = [d for d in shown if d.get('subjectCode') == code]
        eng = [d for d in mine if d.get('language') == 'English']
        clean_eng = [d for d in eng if d['sourceSite'] == 'NTA']
        dated = {(d['examDate'], d['shift']) for d in eng if d.get('examDate')}
        language_subject = code.startswith('1') and v['name'].split('/')[0].strip() != 'English' or code.startswith('2')
        if eng and len(dated) >= v['n']:
            continue
        missing.append({'year': y, 'subject_code': code, 'subject': v['name'], 'sessions_held': v['n'], 'papers_found_any_language': len(mine), 'english_only_papers': len(eng), 'clean_nta_english_only': len(clean_eng),
                        'english_sessions_with_date': len(dated), 'english_only_missing': 'whole subject' if not eng else f'{max(0, v["n"] - len(dated))} of {v["n"]} sessions',
                        'other_versions_found': '; '.join(sorted({d.get('language') or 'not verified' for d in mine if d.get('language') != 'English'})),
                        'note': 'A language-subject paper is in its own language by nature; no English-only paper exists for it.' if language_subject else ''})
write('cuet-pyq-missing.csv', missing)

# ---- figures for the written report
shownq = [d for d in papers if d['kind'] == 'QUESTION_PAPER' and not d.get('replacedBy') and reachable(d)]
print('records', len(docs), '| distinct question papers (copies folded)', len(shownq), '| copies of an NTA file', sum(1 for d in docs if d.get('replacedBy') and d['kind'] == 'QUESTION_PAPER'))
for y in (2024, 2025, 2026):
    ps = [d for d in shownq if d['year'] == y]
    nta = [d for d in ps if d['sourceSite'] == 'NTA']
    print(y, 'papers', len(ps), '| NTA clean originals', len(nta), Counter(d.get('language') for d in nta), '| English-only', sum(d.get('language') == 'English' for d in ps),
          '| English-only AND clean NTA', sum(d.get('language') == 'English' and d['sourceSite'] == 'NTA' for d in ps), '| by source', Counter(d['sourceSite'] for d in ps))
print('clean NTA English-only papers:', [(d['year'], d['subjectName'], d.get('examDate'), d.get('pages')) for d in shownq if d['sourceSite'] == 'NTA' and d.get('language') == 'English'])
print('missing rows', len(missing), '| whole-subject gaps by year', Counter(m['year'] for m in missing if m['english_only_missing'] == 'whole subject'))
print('non-language subjects with no English-only paper:', [(m['year'], m['subject']) for m in missing if m['english_only_missing'] == 'whole subject' and not m['note']][:60])
