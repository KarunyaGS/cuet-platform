"""
Discover official NTA CUET-UG documents (question papers and answer keys) from NTA's own pages.

- Reads only public listing pages of the official CUET UG website and NTA's notice archive, one page per second, with an honest
  identifying User-Agent (no browser spoofing, no login, no bypass of anything).
- Writes manifest-candidates.json: every PDF link found with its title, listing page and year hints. Nothing is downloaded here.
Usage: python discover.py <out-dir>
"""
import html, json, re, sys, time, urllib.request, urllib.error

UA = 'CUETPrepArchiver/1.0 (document archiving for a study platform)'
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.status, r.read().decode('utf-8', 'ignore')

def pdf_links(page_html, listing):
    found = []
    # a row/list item is the unit: take the title text of the nearest heading/anchor and every pdf link inside
    for block in re.split(r'(?=<li[\s>])|(?=<tr[\s>])|(?=<article[\s>])', page_html):
        links = re.findall(r'href="([^"]+?\.pdf)"', block, re.I)
        if not links:
            continue
        text = html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', block))).strip()
        date = re.search(r'\b(\d{1,2}[-/ ](?:\d{1,2}|[A-Za-z]{3,9})[-/ ]\d{4})\b', text)
        for u in dict.fromkeys(links):
            found.append({'url': u, 'text': text[:400], 'date_text': date.group(1) if date else None, 'listing': listing})
    return found

LISTINGS = [
    ('https://cuet.nta.nic.in/document-category/public-notice/', 'page/{n}/', 40),
    ('https://cuet.nta.nic.in/document-category/2025-archive/', 'page/{n}/', 40),
]
out, log = [], []
for base, pager, maxpages in LISTINGS:
    for n in range(1, maxpages + 1):
        url = base if n == 1 else base + pager.format(n=n)
        try:
            status, body = get(url)
        except urllib.error.HTTPError as e:
            log.append({'url': url, 'status': e.code})
            break
        except Exception as e:  # network trouble: record and stop this listing
            log.append({'url': url, 'error': str(e)})
            break
        items = pdf_links(body, url)
        log.append({'url': url, 'status': status, 'pdf_links': len(items)})
        out += items
        if not items:
            break
        time.sleep(1)

# NTA's notice archive (old site): single page; record what it offers
for url in ['https://nta.ac.in/NoticeBoardArchive']:
    try:
        status, body = get(url)
        items = pdf_links(body, url)
        log.append({'url': url, 'status': status, 'pdf_links': len(items)})
        out += items
    except Exception as e:
        log.append({'url': url, 'error': str(e)})

seen, uniq = set(), []
for it in out:
    if it['url'] in seen:
        continue
    seen.add(it['url'])
    uniq.append(it)
json.dump({'listings': log, 'candidates': uniq}, open(OUT + '/manifest-candidates.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('listing pages read:', len(log), '| distinct pdf links:', len(uniq))
