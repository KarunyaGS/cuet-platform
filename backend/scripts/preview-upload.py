"""
Uploads the files the preview database refers to into the preview bucket ONLY (cuet-prep-preview-storage): lesson media, source
documents and the six sample PDFs. Objects are read from the local R2 store; nothing is read from or written to production.

  python backend/scripts/preview-upload.py <work-dir> [--dry-run]
"""
import concurrent.futures, glob, json, mimetypes, os, sqlite3, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WRANGLER = os.path.join(ROOT, '..', 'node_modules', 'wrangler', 'bin', 'wrangler.js')
ENV = {**os.environ, 'TEMP': 'D:/tmp', 'TMP': 'D:/tmp', 'CI': 'true'}
BUCKET = 'cuet-prep-preview-storage'   # the ONLY destination
R2 = os.path.join(ROOT, '.wrangler', 'state', 'v3', 'r2')
LOCAL_BUCKET = 'cuet-platform-media-dev'
SAMPLE_DOCS = ['pyq_7957fad5625f4951b1ed34bc5afe019c', 'pyq_8732bf0d9d4945a794841d10e79baaf9', 'pyq_601cca7416f74bd6bd1b98e60cddac17',
               'pyq_7edce45fe54a49b2bb04290109774468', 'pyq_0818de51307a45628404545781be2890', 'pyq_a6a9ebd442d54f6192f9037c2b15927d']
dry = '--dry-run' in sys.argv
work = sys.argv[1]

# keys the PREPARED preview database refers to (it is the copy made by preview-load.py build)
f = [x for x in glob.glob(os.path.join(work, 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject', '*.sqlite')) if sqlite3.connect(x).execute("select count(*) from sqlite_master where name='admission_sources'").fetchone()[0]][0]
c = sqlite3.connect(f)
keys = {r[0] for r in c.execute('select r2_key from media_assets where r2_key is not null')}
keys |= {r[0] for r in c.execute('select r2_key from source_documents where r2_key is not null')}
keys |= {r[0] for r in c.execute(f"select r2_key from pyq_documents where r2_key is not null")}
print('keys to upload:', len(keys))

# local object store: key -> blob file
index = {}
for db in glob.glob(os.path.join(R2, 'miniflare-R2BucketObject', '*.sqlite')):
    try:
        cc = sqlite3.connect('file:' + db + '?mode=ro', uri=True)
        rows = cc.execute('select key, blob_id from _mf_objects').fetchall()
    except Exception:
        continue
    if any(k in keys for k, _ in rows):
        for k, b in rows:
            p = os.path.join(R2, LOCAL_BUCKET, 'blobs', b)
            if os.path.exists(p) and k in keys: index.setdefault(k, p)
missing = sorted(keys - set(index))
print('found locally:', len(index), '| missing locally:', len(missing), missing[:5])


def put(item):
    key, path = item
    ctype = 'application/pdf' if key.endswith('.pdf') else (mimetypes.guess_type(key)[0] or 'application/octet-stream')
    r = subprocess.run(['node', WRANGLER, 'r2', 'object', 'put', f'{BUCKET}/{key}', '--file', path, '--content-type', ctype, '--remote'], cwd=ROOT, env=ENV, capture_output=True, text=True, encoding='utf-8', errors='replace')
    return key, r.returncode, (r.stderr or r.stdout)[-200:]


if dry:
    sys.exit(0)
done, failed = 0, []
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
    for key, code, msg in ex.map(put, sorted(index.items())):
        done += 1
        if code: failed.append((key, msg))
        if done % 25 == 0: print('uploaded', done, 'of', len(index), flush=True)
json.dump({'uploaded': done - len(failed), 'failed': failed, 'missing': missing}, open(os.path.join(work, 'upload-report.json'), 'w'), indent=1)
print('done:', done - len(failed), 'uploaded,', len(failed), 'failed,', len(missing), 'missing locally')
