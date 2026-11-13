"""Rights audit of the AglaSem records in content/pyq/index.json: what each is, and whether it may be extracted and
re-published as a CUET Prep document. Writes aglasem-rights-audit.csv beside this script.

A record is eligible only with a permission or licence on record. None is assumed.
Run:  python research/cuet-pyq-2024-2026/rights_audit.py
"""
import csv, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
index = json.load(open(os.path.join(ROOT, 'content', 'pyq', 'index.json'), encoding='utf8'))
# Permissions on record. Empty: no rights holder has granted reproduction of any of these documents.
PERMISSIONS = {}

rows = []
for d in index['documents']:
    if d['sourceSite'] != 'AglaSem':
        continue
    kind = {'QUESTION_PAPER': 'Question paper', 'ANSWER_KEY': 'Answer key', 'SAMPLE_PAPER': 'Sample paper'}[d['kind']]
    if d['kind'] == 'SAMPLE_PAPER':
        owner, why = 'Not established (the file does not say who wrote it)', 'No licence is stated on the page or in the file, and the author is not established.'
    else:
        owner, why = 'National Testing Agency (the questions); AglaSem added a cover page or watermark', 'NTA allows reproduction only after permission is taken; none is on record. AglaSem states no licence for its copy.'
    granted = PERMISSIONS.get(d['key'])
    rows.append({
        'record_key': d['key'], 'type': kind, 'year': d['year'] or '', 'subject': d.get('subjectName') or '(all subjects)', 'subject_code': d.get('subjectCode') or '', 'exam_date': d.get('examDate') or 'not stated by source',
        'shift': d.get('shift') or 'not stated by source', 'language': d.get('language') or ('not applicable' if d['kind'] == 'ANSWER_KEY' else 'not verified'), 'pages': d.get('pages') or '', 'source': 'AglaSem',
        'source_page_url': d['sourcePageUrl'], 'document_page_url': d.get('documentPageUrl') or '', 'file_url': d['fileUrl'], 'content_owner': owner,
        'permission_or_licence_on_record': granted or 'None', 'eligible_for_extraction_and_republication': 'yes' if granted else 'no', 'reason': 'Permission on record.' if granted else why,
        'same_file_on_nta_site': d.get('replacedBy') or '', 'shown_to_students_now': 'yes, as a link to the source' if (d['working'] and not d.get('replacedBy') and (d['kind'] == 'ANSWER_KEY' or d.get('language') == 'English')) else 'no',
        'what_happens_instead': 'Keeps its link to the source.' + (' Students can use CUET Prep practice papers for this subject.' if d['kind'] != 'ANSWER_KEY' else ' NTA\'s own key is linked where NTA hosts it.'),
    })
with open(os.path.join(HERE, 'aglasem-rights-audit.csv'), 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
from collections import Counter
print('AglaSem records', len(rows), Counter(r['type'] for r in rows), '| by year', Counter(str(r['year']) for r in rows if r['type'] == 'Question paper'))
print('eligible', sum(r['eligible_for_extraction_and_republication'] == 'yes' for r in rows), '| need permission', sum(r['eligible_for_extraction_and_republication'] == 'no' for r in rows), '| shown now as a link', sum(r['shown_to_students_now'].startswith('yes') for r in rows), '| same file on NTA', sum(bool(r['same_file_on_nta_site']) for r in rows))
print('languages of question papers', Counter(r['language'] for r in rows if r['type'] == 'Question paper'))
