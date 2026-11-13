"""Compares an NTA original with a third-party copy that looks like the same paper, page by page.

For each pair: NTA's file is fetched once and each page drawn small; the third-party site's page pictures are fetched;
every NTA page is compared with the page at the same place in the copy (after the copy's added cover pages) and, as a
control, with the next page. Side-by-side sheets are saved for a person to look at. Downloaded files are deleted.
Writes D:/tmp/pyq/dup/ (sheets, result.json) and duplicate-comparison.csv beside this script.
Run:  python research/cuet-pyq-2024-2026/compare_duplicates.py
"""
import csv, io, json, os, subprocess, time
import pypdfium2
from PIL import Image, ImageChops, ImageDraw, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(os.environ.get('PYQ_WORK', 'D:/tmp/pyq'), 'dup')
os.makedirs(OUT, exist_ok=True)
UA = 'cuet-prep-inventory/0.1 (builds a link inventory of public pages; automated)'
PAIRS = [('nta:paper:Paper_20260827151938', 'aglasem:6b225d90-c701-11f1-8661-0aa932765c8b'), ('nta:paper:Paper_20240930154943', 'aglasem:339bc0f8-1277-11f1-ac7f-0a5e36bc6706'),
         ('nta:paper:Paper_20240930155738', 'aglasem:3c7cf9ee-1277-11f1-8401-0a5e36bc6706'), ('nta:paper:Paper_20240930155914', 'aglasem:3af39330-1277-11f1-860a-0a5e36bc6706')]
docs = {d['key']: d for d in json.load(open(os.path.join(ROOT, 'content', 'pyq', 'index.json'), encoding='utf8'))['documents']}
SIZE = (96, 136)


def get(url, path):
    if not (os.path.exists(path) and os.path.getsize(path) > 500):
        subprocess.run(['curl', '-s', '-L', '-m', '240', '-A', UA, '-o', path, url])
        time.sleep(0.8)
    return path


def small(img):
    return img.convert('L').resize(SIZE, Image.BILINEAR)


def alike(a, b):
    return round(1 - ImageStat.Stat(ImageChops.difference(a, b)).mean[0] / 255, 4)


rows, result = [], {}
for nk, ak in PAIRS:
    n, a = docs[nk], docs[ak]
    tag = nk.split(':')[-1]
    pdf_path = get(n['fileUrl'], os.path.join(OUT, tag + '.pdf'))
    pdf = pypdfium2.PdfDocument(pdf_path)
    nta_pages = [pdf[i].render(scale=0.9).to_pil().convert('RGB') for i in range(len(pdf))]
    pdf.close()
    os.remove(pdf_path)
    base = a['fileUrl'].rsplit('/', 1)[0]
    copy_pages = []
    for i in range(1, a['pages'] + 1):
        try:
            copy_pages.append(Image.open(get(f'{base}/{i}.jpg', os.path.join(OUT, f'{tag}_c{i}.jpg'))).convert('RGB'))
        except Exception:
            copy_pages.append(None)
    extra = len(copy_pages) - len(nta_pages)
    best = None
    for off in range(0, max(extra, 0) + 1):  # where the copy's added pages sit: before, after, or both
        scores = [alike(small(p), small(copy_pages[i + off])) if copy_pages[i + off] is not None else 0 for i, p in enumerate(nta_pages)]
        if best is None or sum(scores) > sum(best[1]):
            best = (off, scores)
    off, scores = best
    control = [alike(small(p), small(copy_pages[(i + off + 1) % len(copy_pages)])) for i, p in enumerate(nta_pages) if copy_pages[(i + off + 1) % len(copy_pages)] is not None]
    # side-by-side sheets: every page, NTA on the left, the copy on the right
    W, H = 330, 460
    per = 6
    for s in range(0, len(nta_pages), per):
        sheet = Image.new('RGB', (W * 2 * 3, (H + 22) * 2), 'white')
        dr = ImageDraw.Draw(sheet)
        for j, p in enumerate(nta_pages[s:s + per]):
            i = s + j
            x, y = (j % 3) * W * 2, (j // 3) * (H + 22)
            for k, im in enumerate((p, copy_pages[i + off])):
                if im is None:
                    continue
                t = im.copy()
                t.thumbnail((W - 6, H))
                sheet.paste(t, (x + k * W + 3, y + 20))
            dr.text((x + 4, y + 4), f'NTA p{i + 1}  |  copy p{i + off + 1}   alike {scores[i]}', fill='red')
        sheet.save(os.path.join(OUT, f'{tag}_sheet{s // per + 1:02d}.png'))
    for f in os.listdir(OUT):
        if f.startswith(tag + '_c'):
            os.remove(os.path.join(OUT, f))
    row = {'nta_record': nk, 'copy_record': ak, 'year': n['year'], 'subject': n['subjectName'], 'nta_pages': len(nta_pages), 'copy_pages': len(copy_pages), 'pages_added_by_copy': extra, 'copy_pages_before_paper': off,
           'pages_compared': len(scores), 'lowest_page_likeness': min(scores), 'average_page_likeness': round(sum(scores) / len(scores), 4), 'control_average_wrong_page': round(sum(control) / len(control), 4),
           'pages_below_0_90': sum(s < 0.90 for s in scores)}
    rows.append(row)
    result[nk] = {**row, 'scores': scores}
    print(row, flush=True)
with open(os.path.join(HERE, 'duplicate-comparison.csv'), 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
json.dump(result, open(os.path.join(OUT, 'result.json'), 'w', encoding='utf8'), indent=1)
