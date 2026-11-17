"""
Builds DEMO-ONLY data for the isolated preview Worker "cuet-prep-preview" and loads it into ITS OWN database (cuet-prep-preview-db).
Never touches production: every remote command uses `--env preview`, and the script refuses to run if the preview database id in
wrangler.jsonc is the production one.

  python backend/scripts/preview-load.py build   <work-dir>      copy the local state, remove every personal/student table, hide documents without a file, export INSERTs
  python backend/scripts/preview-load.py load    <work-dir>      load the INSERTs into the preview database (chunks, INSERT OR IGNORE)
  python backend/scripts/preview-load.py compare <work-dir>      row counts: prepared copy vs preview database

Left out on purpose (people's data): users, credentials, sessions, roles, progress, answers, bookmarks, flashcards, notes, plans, emails,
audit logs, rate limits, reviewer assignments, bulk-approval batches, and every table that references one of them.
"""
import glob, json, os, re, shutil, sqlite3, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
WRANGLER = os.path.join(ROOT, '..', 'node_modules', 'wrangler', 'bin', 'wrangler.js')
ENV = {**os.environ, 'TEMP': 'D:/tmp', 'TMP': 'D:/tmp', 'CI': 'true'}
PROD_DB = 'c2902e7e-d77a-49fc-ae05-f18a513df22a'
PERSONAL = {'users', 'user_roles', 'user_credentials', 'user_sessions', 'password_reset_tokens', 'email_messages', 'email_suppressions', 'audit_logs', 'rate_limits',
            'subscriptions', 'student_preferences', 'reminder_dismissals', 'review_assignments', 'bulk_approval_batches', 'practice_sessions', 'topic_progress',
            'bookmarks', 'learning_activity', 'study_plan_items', 'flashcards', 'annotations'}
SKIP = {'d1_migrations', 'sqlite_sequence'}
# The six sample PDFs the preview stores (everything else keeps its row but is hidden, because its file is not uploaded).
SAMPLE_DOCS = ['pyq_7957fad5625f4951b1ed34bc5afe019c', 'pyq_8732bf0d9d4945a794841d10e79baaf9', 'pyq_601cca7416f74bd6bd1b98e60cddac17',
               'pyq_7edce45fe54a49b2bb04290109774468', 'pyq_0818de51307a45628404545781be2890', 'pyq_a6a9ebd442d54f6192f9037c2b15927d']

cfg = open(os.path.join(ROOT, 'wrangler.jsonc'), encoding='utf-8').read()
m = re.search(r'"preview": \{.*?"database_id": "([0-9a-f-]+)"', cfg, re.S)
if not m or m.group(1) == PROD_DB or 'PLACEHOLDER' in m.group(1):
    sys.exit('Refused: the preview database id is missing or is the production one.')
PREVIEW_DB = m.group(1)


def wr(args, **kw):
    return subprocess.run([sys.executable and 'node', WRANGLER, *args], cwd=ROOT, env=ENV, capture_output=True, text=True, encoding='utf-8', errors='replace', **kw)


def tables_in_order(c):
    names = [r[0] for r in c.execute("select name from sqlite_master where type='table' and name not like 'sqlite_%' and name not like '_cf_%'")]
    deps = {t: {r[0] for r in c.execute(f"select \"table\" from pragma_foreign_key_list('{t}')") if r[0] != t and r[0] in names} for t in names}
    out, seen = [], set()
    def visit(t):
        if t in seen: return
        seen.add(t)
        for p in sorted(deps[t]): visit(p)
        out.append(t)
    for t in sorted(names): visit(t)
    return out, deps


def build(work):
    os.makedirs(work, exist_ok=True)
    state = os.path.join(work, 'state')
    if os.path.exists(state): shutil.rmtree(state)
    os.makedirs(os.path.join(state, 'v3', 'd1'))
    shutil.copytree(os.path.join(ROOT, '.wrangler', 'state', 'v3', 'd1'), os.path.join(state, 'v3', 'd1'), dirs_exist_ok=True)
    f = [x for x in glob.glob(os.path.join(state, 'v3', 'd1', 'miniflare-D1DatabaseObject', '*.sqlite')) if sqlite3.connect(x).execute("select count(*) from sqlite_master where name='admission_sources'").fetchone()[0]][0]
    c = sqlite3.connect(f)
    order, deps = tables_in_order(c)
    excluded = set(PERSONAL)
    changed = True
    while changed:  # a table that references an excluded table is excluded too
        changed = False
        for t, ds in deps.items():
            if t not in excluded and ds & excluded: excluded.add(t); changed = True
    removed = {}
    for t in sorted(excluded):
        if t in [o for o in order]:
            n = c.execute(f'select count(*) from "{t}"').fetchone()[0]
            c.execute(f'delete from "{t}"')
            removed[t] = n
    # documents whose file is not uploaded: keep the row, hide it
    keep = ','.join(f"'{d}'" for d in SAMPLE_DOCS)
    hidden = c.execute(f"update pyq_documents set r2_key = NULL, review_state = 'PREVIEW_NO_FILE' where r2_key is not null and id not in ({keep})").rowcount
    c.execute(f"delete from pyq_hosted_files where document_id not in ({keep})")
    c.commit()
    # sanity: no personal data left
    leaks = []
    for t in order:
        if t in excluded: continue
        cols = [r[1] for r in c.execute(f'pragma table_info("{t}")') if (r[2] or '').upper() in ('TEXT', '')]
        for col in cols:
            n = c.execute(f'select count(*) from "{t}" where "{col}" like ? or "{col}" like ?', ('%gmail.com%', '%karunya%')).fetchone()[0]
            if n: leaks.append((t, col, n))
    c.close()
    json.dump({'excluded': sorted(excluded), 'removedRows': removed, 'hiddenDocuments': hidden, 'leakScan': leaks}, open(os.path.join(work, 'build-report.json'), 'w'), indent=1)
    print('excluded tables:', len(excluded), '| hidden documents without a file:', hidden, '| possible personal-data hits:', leaks)
    if leaks: sys.exit('Stopped: personal data may remain (see build-report.json).')
    # INSERT statements straight from the prepared copy (parents first); one JSON string per statement, because values may contain newlines.
    c = sqlite3.connect(f)
    stmts, counts = [], {}
    for t in order:
        if t in excluded or t in SKIP: continue
        cols = [r[1] for r in c.execute(f'pragma table_info("{t}")')]
        q = ', '.join(f'quote("{col}")' for col in cols)
        head = f'INSERT OR IGNORE INTO "{t}" (' + ', '.join(f'"{col}"' for col in cols) + ') VALUES ('
        n = 0
        for row in c.execute(f'select {q} from "{t}"'):
            stmts.append(head + ', '.join(row) + ');')
            n += 1
        counts[t] = n
    c.close()
    with open(os.path.join(work, 'data.jsonl'), 'w', encoding='utf-8') as out:
        for x in stmts: out.write(json.dumps(x) + chr(10))
    json.dump(counts, open(os.path.join(work, 'counts.json'), 'w'), indent=1)
    big = max(len(x.encode('utf-8')) for x in stmts)
    print(len(stmts), 'INSERT statements in', len(counts), 'tables; largest statement', big, 'bytes ->', os.path.join(work, 'data.jsonl'))


def load(work):
    lines = [json.loads(l) for l in open(os.path.join(work, 'data.jsonl'), encoding='utf-8') if l.strip()]
    CHUNK = 4000
    for i in range(0, len(lines), CHUNK):
        part = os.path.join(work, f'part{i // CHUNK + 1}.sql')
        open(part, 'w', encoding='utf-8').write('\n'.join(['PRAGMA defer_foreign_keys = true;', *lines[i:i + CHUNK]]) + '\n')
        r = wr(['d1', 'execute', 'DB', '--env', 'preview', '--remote', '--file', part, '--yes'])
        print('chunk', i // CHUNK + 1, 'ok' if r.returncode == 0 else 'FAILED', (r.stderr or r.stdout)[-300:] if r.returncode else '')
        if r.returncode: sys.exit(1)


def wipe(work):
    """Empties the CONTENT tables of the PREVIEW database (after clearing the demo students' activity that points at them). Accounts and sign-ins stay."""
    counts = json.load(open(os.path.join(work, 'counts.json')))
    activity = ['practice_answers', 'practice_sessions', 'learning_activity', 'topic_progress', 'bookmarks', 'flashcard_reviews', 'flashcards', 'annotations', 'study_plan_items', 'daily_goals', 'student_preferences', 'reminder_dismissals']
    stmts = ['PRAGMA defer_foreign_keys = true;'] + [f'DELETE FROM "{t}";' for t in activity] + [f'DELETE FROM "{t}";' for t in reversed(list(counts))]
    part = os.path.join(work, 'wipe.sql')
    open(part, 'w', encoding='utf-8').write(chr(10).join(stmts) + chr(10))
    r = wr(['d1', 'execute', 'DB', '--env', 'preview', '--remote', '--file', part, '--yes'])
    print('wipe', 'ok' if r.returncode == 0 else 'FAILED', (r.stderr or r.stdout)[-400:] if r.returncode else '')
    if r.returncode: sys.exit(1)


def grant(work):
    """Re-applies the demo roles (a wipe cascades through `roles` and removes assignments). Demo accounts are matched by their synthetic addresses."""
    sql = ("insert or ignore into user_roles (user_id, role_id) select id, 'role_student' from users where email in ('demo-student@cuet-preview.test','demo-admin@cuet-preview.test'); "
           "insert or ignore into user_roles (user_id, role_id) select id, 'role_super_admin' from users where email = 'demo-admin@cuet-preview.test'; "
           "insert or ignore into user_roles (user_id, role_id) select id, 'role_student' from users where id not in (select user_id from user_roles)")
    r = wr(['d1', 'execute', 'DB', '--env', 'preview', '--remote', '--command', sql])
    print('grant', 'ok' if r.returncode == 0 else 'FAILED')


def compare(work):
    counts = json.load(open(os.path.join(work, 'counts.json')))
    bad = 0
    for t, n in counts.items():
        r = wr(['d1', 'execute', 'DB', '--env', 'preview', '--remote', '--json', '--command', f'select count(*) as n from "{t}"'])
        try: got = json.loads(r.stdout)[0]['results'][0]['n']
        except Exception: got = f'error {r.stderr[-120:]}'
        if got != n: bad += 1; print('DIFF', t, 'prepared', n, 'preview', got)
    print('tables compared:', len(counts), '| differences:', bad)


{'build': build, 'load': load, 'compare': compare, 'wipe': wipe, 'grant': grant}[sys.argv[1]](sys.argv[2])
