"""
Removes the internal review preview and everything created for it. It touches ONLY these three resources:
  Worker  cuet-prep-preview
  D1      cuet-prep-preview-db
  R2      cuet-prep-preview-storage   (emptied first, then deleted)
Production (Worker "cuet", D1 "cuet-db", R2 "cuet-storage") is never named here.

  python backend/scripts/preview-cleanup.py            shows what would be removed
  python backend/scripts/preview-cleanup.py --confirm  removes it (cannot be undone)
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WRANGLER = os.path.join(ROOT, '..', 'node_modules', 'wrangler', 'bin', 'wrangler.js')
ENV = {**os.environ, 'TEMP': os.environ.get('TEMP', 'D:/tmp'), 'CI': 'true'}
WORKER, DB, BUCKET = 'cuet-prep-preview', 'cuet-prep-preview-db', 'cuet-prep-preview-storage'
assert 'production' not in (WORKER + DB + BUCKET) and DB != 'cuet-db' and BUCKET != 'cuet-storage'
confirm = '--confirm' in sys.argv


def w(*a):
    return subprocess.run(['node', WRANGLER, *a], cwd=ROOT, env=ENV, capture_output=True, text=True, encoding='utf-8', errors='replace')


print('Will remove: Worker', WORKER, '| D1', DB, '| R2 bucket', BUCKET, '(and every object in it)')
if not confirm:
    print('Dry run only. Add --confirm to delete.')
    sys.exit(0)
# 1) the Worker (its URL stops working)
print(w('delete', '--name', WORKER, '--force').stdout[-300:])
# 2) empty the bucket (R2 refuses to delete a bucket that has objects), then delete it
keys = []
cursor = None
while True:
    args = ['r2', 'object', 'list', BUCKET, '--remote', '--json'] + (['--cursor', cursor] if cursor else [])
    r = w(*args)
    try:
        data = json.loads(r.stdout)
    except Exception:
        break
    objs = data.get('objects', data if isinstance(data, list) else [])
    keys += [o['key'] for o in objs]
    cursor = data.get('cursor') if isinstance(data, dict) and data.get('truncated') else None
    if not cursor:
        break
print(len(keys), 'objects to delete')
for k in keys:
    w('r2', 'object', 'delete', f'{BUCKET}/{k}', '--remote')
print(w('r2', 'bucket', 'delete', BUCKET).stdout[-200:])
# 3) the database
print(w('d1', 'delete', DB, '--skip-confirmation').stdout[-200:])
print('Done. Also delete the "env.preview" block in backend/wrangler.jsonc and frontend/dist-preview if you no longer need them.')
