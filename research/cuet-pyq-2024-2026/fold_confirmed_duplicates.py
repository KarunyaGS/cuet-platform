"""Folds a third-party copy under NTA's original where the two were confirmed to be the same examination paper.

Reads duplicate-comparison.csv (written by compare_duplicates.py). A pair is folded only if every page was compared,
no page fell below the likeness bar, and the pair is in LOOKED_AT (a person looked at the side-by-side pages).
The copy's record is kept, with its source addresses; it gets `replacedBy`, so students see one row: NTA's file.
Safe to run again. Order: after add_new_nta.py.
Run:  python research/cuet-pyq-2024-2026/fold_confirmed_duplicates.py
"""
import csv, json, os
HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.abspath(os.path.join(HERE, '..', '..', 'content', 'pyq', 'index.json'))
BAR = 0.97
LOOKED_AT = {'nta:paper:Paper_20260827151938', 'nta:paper:Paper_20240930154943', 'nta:paper:Paper_20240930155738', 'nta:paper:Paper_20240930155914'}
index = json.load(open(INDEX, encoding='utf8'))
docs = {d['key']: d for d in index['documents']}
folded = 0
for r in csv.DictReader(open(os.path.join(HERE, 'duplicate-comparison.csv'), encoding='utf-8-sig')):
    n, c = docs[r['nta_record']], docs[r['copy_record']]
    same = r['nta_record'] in LOOKED_AT and int(r['pages_compared']) == int(r['nta_pages']) and int(r['pages_below_0_90']) == 0 and float(r['lowest_page_likeness']) >= BAR \
        and n['year'] == c['year'] and n['subjectCode'] == c['subjectCode'] and n['language'] == c['language']
    print(r['year'], r['subject'], '| same paper:', same, '| lowest page likeness', r['lowest_page_likeness'])
    if not same:
        continue
    check = {'sameAs': n['key'], 'checkedOn': '2026-11-13', 'method': 'every page of NTA\'s file compared with the page at the same place in the copy; side-by-side pages looked at', 'pagesCompared': int(r['pages_compared']),
             'lowestPageLikeness': float(r['lowest_page_likeness']), 'pagesAddedByCopy': int(r['pages_added_by_copy'])}
    if c.get('replacedBy') != n['key']:
        c['replacedBy'] = n['key']
        c['note'] = c['note'].rstrip() + f' Confirmed on 13 November 2026 to be the same paper as NTA\'s file {n["fileUrl"]} (all {r["pages_compared"]} pages match; the copy adds {r["pages_added_by_copy"]} page(s) of its own). Students are shown NTA\'s file.'
        folded += 1
    c['duplicateCheck'] = check
index['report']['aglasem_copies_of_nta_files'] = sum(1 for d in index['documents'] if d.get('replacedBy') and d['sourceSite'] == 'AglaSem' and d['kind'] == 'QUESTION_PAPER')
json.dump(index, open(INDEX, 'w', encoding='utf8', newline='\n'), indent=1, ensure_ascii=False)
shown = [d for d in index['documents'] if not d.get('replacedBy') and (d['working'] or d['httpStatus'] == -1) and (d['kind'] == 'ANSWER_KEY' or d.get('language') == 'English')]
print('folded now', folded, '| records', len(index['documents']), '| student-facing', len(shown), '| of which question papers', sum(d['kind'] == 'QUESTION_PAPER' for d in shown))
