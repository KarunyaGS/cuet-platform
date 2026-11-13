"""Adds the verified language to nta-new-candidates.csv. The language of each file was established by reading its text
(2024 booklets and text papers) or by looking at its question images (scanned papers); see languageBasis.
Run after check_new_nta.py:  python research/cuet-pyq-2024-2026/annotate_new_nta.py
"""
import csv, os
from collections import Counter
HERE = os.path.dirname(os.path.abspath(__file__))
p = os.path.join(HERE, 'nta-new-candidates.csv')
rows = list(csv.DictReader(open(p, encoding='utf-8-sig')))
OWN = {'Hindi', 'Urdu', 'Telugu', 'Tamil', 'Punjabi', 'Odia', 'Marathi', 'Malayalam', 'Kannada', 'Gujarati', 'Bengali', 'Assamese', 'Spanish'}
BOOKLET = {'111620248309': 'English + Bengali', '111620248232': 'English + Punjabi', '111620247694': 'English + Bengali', '111620248031': 'English + Bengali', '111620247855': 'English + Odia',
           '111620248079': 'English + Odia', '111620248179': 'English + Bengali'}
TEXT_ENGLISH = {'Paper_20240930155738', 'Paper_20240930155914'}
IMAGES_ENGLISH = {'Paper_20240930154943', 'Paper_20240930155013'}
for r in rows:
    name, subj, year = r['file_url'].rsplit('/', 1)[1][:-4], r['subject_given_by_page'], r['year_given_by_page']
    if subj == 'English':
        lang, basis = 'English', 'a page of the paper was looked at; the English language paper'
    elif subj in OWN:
        lang, basis = subj, 'a page of the paper was looked at (or its text read); a language paper, in its own language'
    elif name in BOOKLET:
        lang, basis = BOOKLET[name], 'the text of every page was read; the booklet prints each question in two languages'
    elif name in TEXT_ENGLISH:
        lang, basis = 'English', 'the text of every page was read; only English is in it'
    elif name in IMAGES_ENGLISH:
        lang, basis = 'English', 'the file has one picture per question (51 for 50 questions); twelve spread across the paper were looked at, all English'
    elif name == 'Paper_20240930155843':
        lang, basis = 'not verified', 'the text is English but a question picture is in Bengali; not settled'
    elif name.startswith('Paper_2025') or name.startswith('Paper_2026'):
        lang, basis = 'English + Hindi', 'the file has two pictures per question (about 100 for 50 questions); pages looked at show English and Hindi versions'
    else:
        lang, basis = 'not verified', ''
    r['verified_language'], r['language_basis'], r['english_only'] = lang, basis, 'yes' if lang == 'English' else 'no'
    r['watermark_or_third_party_mark'] = 'none: NTA\'s own file on nta.ac.in'
    r['subject_basis'] = 'the file prints no subject heading; the subject is the one the linking page gives, and the page looked at fits it' if name.startswith('Paper_') else 'subject as the linking page gives it; booklet text read'
    r['status'] = 'already in the index' if r['already_in_index'] == 'yes' else 'found and checked; NOT yet added to the student collection (waiting for approval)'
with open(p, 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader(); w.writerows(rows)
for y in ('2024', '2025', '2026'):
    ys = [r for r in rows if r['year_given_by_page'] == y]
    print(y, len(ys), Counter(r['verified_language'] for r in ys), '| English-only:', [r['subject_given_by_page'] for r in ys if r['english_only'] == 'yes'])
