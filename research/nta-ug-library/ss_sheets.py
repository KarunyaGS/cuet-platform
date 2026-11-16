"""Contact sheets of the top of page 1 for SelfStudys files with no text layer, labelled with the record's subject, for a person to read.
Usage: python ss_sheets.py results.json out-dir"""
import json, os, sys
import pypdfium2 as pdfium
from PIL import Image, ImageDraw

res, out = sys.argv[1:3]
os.makedirs(out, exist_ok=True)
rows = [r for r in json.load(open(res, encoding='utf-8'))['results'] if r['status'] == 'OK' and r['textChars'] < 500]
rows.sort(key=lambda r: (r['year'], r['subjectCode'], r['slug']))
W, H, PER = 760, 210, 6
for n in range(0, len(rows), PER):
    chunk = rows[n:n + PER]
    sheet = Image.new('RGB', (W, (H + 22) * len(chunk)), 'white')
    d = ImageDraw.Draw(sheet)
    for i, r in enumerate(chunk):
        page = pdfium.PdfDocument(r['file'])[0]
        img = page.render(scale=1.6).to_pil().convert('RGB')
        img = img.crop((0, 0, img.width, int(img.height * 0.30))).resize((W, H))
        y = i * (H + 22)
        d.rectangle([0, y, W, y + 20], fill='#ffe9a8')
        d.text((4, y + 4), f"#{n + i}  record: {r['year']} {r['subjectCode']} {r['subjectName'][:28]}  | {r['slug']}", fill='black')
        sheet.paste(img, (0, y + 22))
    sheet.save(os.path.join(out, f'sheet-{n // PER:02d}.png'))
print(len(rows), 'files', (len(rows) + PER - 1) // PER, 'sheets')
