"""Records each paper's verified language in content/pyq/index.json.

How each language was established (13 November 2026):
- NTA's 2024 pen-and-paper booklets: every page's text was read by language_check.py. No other script found: English.
  Another script found: bilingual, as the booklet itself says ("printed in English and ...").
- Scanned papers (NTA's computer-based papers and AglaSem's copies): one inner page of each was looked at on the
  contact sheets made by language_check.py. The verdicts are the numbered lists below.
  - 2024 computer-based papers are in one language each.
  - 2025 and 2026 computer-based papers print every question twice, in English and in Hindi: they are bilingual.
    Where the page looked at happened to show only one of the two, the paper is still recorded as bilingual, because
    every 2025 and 2026 paper of this format that showed two questions showed both languages.
- Language-subject papers (Hindi, Tamil ...) are in that language.
- SelfStudys files these papers in its "English" section; that is taken as its statement of the medium.
- Adda247's files could not be looked at (its robots rules), so their language is not recorded.

A paper is never recorded as "English" unless English is the only language found.
Run after language_check.py:  python research/cuet-pyq-2024-2026/apply_language.py
"""
import json, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
WORK = os.environ.get('PYQ_WORK', 'D:/tmp/pyq')
INDEX = os.path.join(ROOT, 'content', 'pyq', 'index.json')
index = json.load(open(INDEX, encoding='utf8'))
checked = json.load(open(os.path.join(WORK, 'lang', 'facts.json'), encoding='utf8'))
facts, tiles = checked['facts'], {int(k): v for k, v in checked['tiles'].items()}

# ---- what was seen on the contact sheets, by tile number
ENGLISH_ONLY = {1, 9, 10, 13, 16, 19, 21, 27, 29, 30, 70, 135, 137, 141, 145, 146, 147, 148} | set(range(105, 130))
ENGLISH_HINDI = {43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 66, 67} | set(range(82, 105)) | {130, 131, 132, 133, 134, 136, 138, 139, 140, 142, 143, 144}
# 2024 pen-and-paper booklets: the code printed at the top of the page names the second language.
REGIONAL = {8: 'English + Assamese', 11: 'English + Bengali', 12: 'English + Assamese', 14: 'English + Tamil', 15: 'English + Assamese', 17: 'English + Assamese', 18: 'English + Kannada', 22: 'English + Odia',
            24: 'English + Odia', 25: 'English + Assamese', 26: 'English + Assamese', 28: 'English + Punjabi'}
OTHER = {20: 'Hindi', 23: 'Bengali', 65: 'Sanskrit'}
SCRIPT_LANGUAGE = {'Devanagari': 'Hindi', 'Tamil': 'Tamil', 'Gurmukhi': 'Punjabi', 'Gujarati': 'Gujarati', 'Odia': 'Odia', 'Telugu': 'Telugu', 'Kannada': 'Kannada', 'Malayalam': 'Malayalam', 'Arabic/Urdu': 'Urdu'}
LANGUAGE_SUBJECTS = {'Hindi', 'Assamese', 'Bengali', 'Gujarati', 'Kannada', 'Malayalam', 'Marathi', 'Odia', 'Punjabi', 'Tamil', 'Telugu', 'Urdu', 'Arabic', 'Spanish', 'Sanskrit'}
key_tile = {v: k for k, v in tiles.items()}

counts = {}
for d in index['documents']:
    if d['kind'] not in ('QUESTION_PAPER', 'SAMPLE_PAPER'):
        continue
    f = facts.get(d['key'], {})
    tile = key_tile.get(d['key'])
    subject = (d.get('subjectName') or '').split('/')[0].strip()
    language, basis = None, 'not verified'
    if subject in LANGUAGE_SUBJECTS:
        language, basis = subject, 'a language-subject paper'
    elif f.get('basis') == 'text':
        others = {k: v for k, v in (f.get('otherScripts') or {}).items() if v > 500}
        if not others:
            language, basis = 'English', 'every page of the file was read; English is the only language in it'
        else:
            prior = d.get('language') if (d.get('language') or '').startswith('English + ') else None
            second = max(others, key=others.get)
            language = prior or ('English + ' + SCRIPT_LANGUAGE.get(second, second))
            basis = 'every page of the file was read; it is a bilingual booklet'
    elif tile in ENGLISH_ONLY:
        language, basis = 'English', 'a page of the paper was looked at'
    elif tile in ENGLISH_HINDI:
        language, basis = 'English + Hindi', 'a page of the paper was looked at; every question is printed in English and in Hindi'
    elif tile in REGIONAL:
        language, basis = REGIONAL[tile], 'the booklet code printed on its pages'
    elif tile in OTHER:
        language, basis = OTHER[tile], 'a page of the paper was looked at'
    elif d['sourceSite'] == 'SelfStudys' and f.get('sourceSection') == 'english':
        language, basis = 'English', 'SelfStudys lists it in its English section'
    d['language'] = language
    d['languageBasis'] = basis
    counts[language or 'not verified'] = counts.get(language or 'not verified', 0) + 1

# A copy and the NTA file it copies are the same paper: they carry the same language.
by_key = {d['key']: d for d in index['documents']}
for d in index['documents']:
    o = by_key.get(d.get('replacedBy') or '')
    if o and d['kind'] == 'QUESTION_PAPER' and o.get('language') and d.get('language') != o['language'] and (o.get('languageBasis') or '').startswith('every page'):
        d['language'], d['languageBasis'] = o['language'], 'same file as NTA\'s, whose every page was read'

json.dump(index, open(INDEX, 'w', encoding='utf8', newline='\n'), indent=1, ensure_ascii=False)
shown = [d for d in index['documents'] if not d.get('replacedBy') and (d['working'] or d['httpStatus'] == -1) and d['kind'] in ('QUESTION_PAPER', 'SAMPLE_PAPER')]
print('all papers and sample papers, by recorded language:', dict(sorted(counts.items(), key=lambda kv: -kv[1])))
for y in (2024, 2025, 2026):
    ps = [d for d in shown if d['kind'] == 'QUESTION_PAPER' and d['year'] == y]
    eng = [d for d in ps if d['language'] == 'English']
    bil = [d for d in ps if d['language'] == 'English + Hindi']
    print(y, 'reachable papers', len(ps), '| English only', len(eng), {s: sum(d['sourceSite'] == s for d in eng) for s in sorted({d['sourceSite'] for d in eng})}, 'in', len({d['subjectSlug'] for d in eng}), 'subjects',
          '| English + Hindi', len(bil), 'in', len({d['subjectSlug'] for d in bil}), 'subjects | other or not verified', len(ps) - len(eng) - len(bil))
print('sample papers in English:', sum(d['kind'] == 'SAMPLE_PAPER' and d['language'] == 'English' for d in shown), 'of', sum(d['kind'] == 'SAMPLE_PAPER' for d in shown))
print('tiles with no verdict:', sorted(t for t in tiles if t not in ENGLISH_ONLY | ENGLISH_HINDI | set(REGIONAL) | set(OTHER) and (facts[tiles[t]].get('subject') or '').split('/')[0].strip() not in LANGUAGE_SUBJECTS))
