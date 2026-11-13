// End-to-end integration trace: makes the API calls the screens make, then reads the database to confirm what
// was written or read. It NEVER touches the working local database or Cloudflare:
//   1. copies backend/.wrangler/state to a throwaway folder,
//   2. applies pending migrations to the copy,
//   3. starts the Worker locally on port 8791 against the copy,
//   4. runs the checks, stops the server and deletes the copy.
//
// Usage (from the repository root):  node backend/scripts/integration-trace.mjs [report.json]
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const backend = join(here, '..');
const wranglerBin = [join(backend, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), join(backend, '..', 'node_modules', 'wrangler', 'bin', 'wrangler.js')].find(existsSync);
if (!wranglerBin) throw new Error('wrangler is not installed (npm install)');
const PORT = 8791;
const A = `http://127.0.0.1:${PORT}`;
const copy = join(process.env.TEMP ?? tmpdir(), `cuet-trace-${Date.now()}`);
const state = join(copy, 'state');
const adminToken = process.env.CUET_ADMIN_TOKEN ?? /^ADMIN_API_TOKEN\s*=\s*"?([^"\r\n]+)"?/m.exec(readFileSync(join(backend, '.dev.vars'), 'utf8'))?.[1];
if (!adminToken) throw new Error('No admin token: create backend/.dev.vars');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (v) => createHash('sha256').update(v).digest('hex');
const results = [];
let group = '';
const check = (name, pass, detail = '') => {
  results.push({ group, name, pass: Boolean(pass), detail: String(detail) });
  console.log(`${pass ? 'PASS' : 'FAIL'}  [${group}] ${name}${detail ? `  (${detail})` : ''}`);
};

// ---------------------------------------------------------------- throwaway copy and server
mkdirSync(copy, { recursive: true });
cpSync(join(backend, '.wrangler', 'state'), state, { recursive: true });
execFileSync(process.execPath, [wranglerBin, 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', state], { cwd: backend, stdio: 'ignore' });
const server = spawn(process.execPath, [wranglerBin, 'dev', '--local', '--port', String(PORT), '--persist-to', state], { cwd: backend, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));
const stopServer = () => {
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    else server.kill('SIGTERM');
  } catch {
    /* already gone */
  }
};

/** Read-only handle on the copy's D1 file (the one that has the newest tables). */
function openDb() {
  const dir = join(state, 'v3', 'd1', 'miniflare-D1DatabaseObject');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite').sort((a, b) => statSync(join(dir, b)).mtimeMs - statSync(join(dir, a)).mtimeMs);
  for (const f of files) {
    const db = new DatabaseSync(join(dir, f), { readOnly: true });
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'email_messages'").get()) return db;
    db.close();
  }
  throw new Error('Could not find the copied D1 database');
}
let db;
const one = (sql, ...p) => db.prepare(sql).get(...p);
const all = (sql, ...p) => db.prepare(sql).all(...p);
const n = (sql, ...p) => Number(Object.values(one(sql, ...p) ?? { n: 0 })[0]);

async function call(method, path, { body, token, headers = {} } = {}) {
  const res = await fetch(`${A}${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  let json = null;
  try {
    json = JSON.parse(buf.toString('utf8'));
  } catch {
    /* not JSON */
  }
  return { status: res.status, json, buf, cookie: res.headers.get('set-cookie') ?? '' };
}
const admin = (method, path, body) => call(method, path, { body, headers: { 'x-admin-token': adminToken } });
const password = () => `Trace-${randomBytes(9).toString('base64url')}`;
async function account(label) {
  const email = `trace-${label}-${Date.now()}@example.test`;
  const pw = password();
  const reg = await call('POST', '/api/auth/register', { body: { email, password: pw, displayName: `Trace ${label}` } });
  const login = await call('POST', '/api/auth/login', { body: { email, password: pw } });
  const token = /cuet_session=([^;]+)/.exec(login.cookie)?.[1] ?? '';
  return { id: reg.json?.id, email, pw, token, reg, login };
}
const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};
const VISIBLE = "v.verification IN ('MACHINE_VERIFIED','VERIFIED') AND v.status != 'ARCHIVED'";
const keyOf = (qid) => JSON.parse(one('SELECT correct_option_positions AS k FROM answer_keys WHERE question_id = ?', qid)?.k ?? '[]');
const wrongFor = (q) => {
  const key = keyOf(q.id);
  return [q.options.find((o) => !key.includes(o.position))?.position ?? 1];
};

async function run() {
  for (let i = 0; i < 60; i++) {
    if ((await fetch(`${A}/api/health`).catch(() => null))?.ok) break;
    await sleep(1000);
  }
  db = openDb();

  // ------------------------------------------------------------ accounts and sessions
  group = 'Accounts';
  const s = await account('student');
  const user = one('SELECT id, status, email_verified_at FROM users WHERE email = ?', s.email);
  check('sign-up writes the account with the student role', s.reg.status === 201 && user?.status === 'ACTIVE' && n("SELECT COUNT(*) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? AND r.code = 'STUDENT'", s.id) === 1, `status ${s.reg.status}`);
  const cred = one('SELECT password_hash, iterations FROM user_credentials WHERE user_id = ?', s.id);
  check('the password is stored only as a salted hash', cred && cred.password_hash !== s.pw && !cred.password_hash.includes(s.pw) && cred.iterations >= 100000, `iterations ${cred?.iterations}`);
  check('sign-in sets an HttpOnly, SameSite=Lax session cookie', s.login.status === 200 && /HttpOnly/i.test(s.login.cookie) && /SameSite=Lax/i.test(s.login.cookie));
  check('the database holds only the hash of the session token', n('SELECT COUNT(*) FROM user_sessions WHERE token_hash = ?', sha256(s.token)) === 1 && n('SELECT COUNT(*) FROM user_sessions WHERE token_hash = ?', s.token) === 0);
  const me = await call('GET', '/api/auth/me', { token: s.token });
  check('"who am I" returns the signed-in student', me.json?.user?.id === s.id && me.json.user.emailVerified === false);
  check('student pages refuse a visitor without a session', (await call('GET', '/api/student/profile')).status === 401);
  check('a second sign-up with the same email is refused', (await call('POST', '/api/auth/register', { body: { email: s.email, password: password(), displayName: 'Dup' } })).status === 409);
  check('a wrong password is refused', (await call('POST', '/api/auth/login', { body: { email: s.email, password: 'not-the-password' } })).status === 401);

  // ------------------------------------------------------------ syllabus explorer
  group = 'Syllabus';
  const exams = await call('GET', '/api/learn/exams');
  check('exam list matches the active exam cycles', exams.json?.length === n("SELECT COUNT(*) FROM exam_cycles WHERE status = 'ACTIVE'"), `${exams.json?.length} exams`);
  const visibleSql = (exam) => n(`SELECT COUNT(DISTINCT v.test_paper_id) FROM syllabus_versions v JOIN test_papers p ON p.id = v.test_paper_id JOIN exam_cycles c ON c.id = p.exam_cycle_id JOIN exams e ON e.id = c.exam_id WHERE e.code = ? AND c.year = 2026 AND ${VISIBLE}`, exam);
  const subjects = {};
  for (const exam of ['CUET_UG', 'CUET_PG']) {
    const r = await call('GET', `/api/learn/exams/${exam}/subjects?year=2026`);
    subjects[exam] = r.json ?? [];
    const total = n('SELECT COUNT(*) FROM test_papers p JOIN exam_cycles c ON c.id = p.exam_cycle_id JOIN exams e ON e.id = c.exam_id WHERE e.code = ? AND c.year = 2026', exam);
    const shown = subjects[exam].filter((x) => x.available).length;
    check(`${exam} subject list: total and visible counts match the database`, subjects[exam].length === total && shown === visibleSql(exam), `${shown} of ${subjects[exam].length} visible`);
  }
  const physics = subjects.CUET_UG.find((x) => x.code === '322');
  const outline = await call('GET', `/api/learn/subjects/${physics.paperId}`);
  const physicsRows = n("SELECT COUNT(*) FROM curriculum_nodes WHERE syllabus_version_id = ? AND verification IN ('MACHINE_VERIFIED','VERIFIED')", physics.versionId);
  check('Physics outline returns every stored syllabus row', outline.json?.nodes?.length === physicsRows, `${outline.json?.nodes?.length} rows`);
  const hidden = subjects.CUET_UG.find((x) => !x.available);
  const hiddenOutline = await call('GET', `/api/learn/subjects/${hidden.paperId}`);
  const hiddenRow = one("SELECT cn.id FROM curriculum_nodes cn JOIN syllabus_versions v ON v.id = cn.syllabus_version_id WHERE v.test_paper_id = ? AND v.status != 'ARCHIVED' LIMIT 1", hidden.paperId);
  check('a paper whose syllabus is not checked yet serves no rows to students', hiddenOutline.status === 200 && hiddenOutline.json.nodes.length === 0 && (!hiddenRow || (await call('GET', `/api/learn/topics/${hiddenRow.id}`)).status === 404), hidden?.code);
  const lessonRow = one("SELECT lr.id, lr.curriculum_node_id AS node FROM learning_resources lr JOIN curriculum_nodes cn ON cn.id = lr.curriculum_node_id WHERE cn.syllabus_version_id = ? AND lr.status != 'ARCHIVED' ORDER BY lr.id LIMIT 1", physics.versionId);
  const topic = await call('GET', `/api/learn/topics/${lessonRow.node}`);
  const src = one('SELECT d.url, d.page_count, d.sha256, d.id FROM syllabus_versions v JOIN source_documents d ON d.id = v.source_document_id WHERE v.id = ?', physics.versionId);
  check('topic page cites the official PDF and page from the database', topic.json?.source?.url === src.url && topic.json.source.pageCount === src.page_count && topic.json.resources.some((r) => r.id === lessonRow.id));
  const lesson = await call('GET', `/api/learn/resources/${lessonRow.id}`);
  check('lesson returns every stored content block', lesson.json?.blocks?.length === n('SELECT COUNT(*) FROM content_blocks WHERE resource_id = ?', lessonRow.id), `${lesson.json?.blocks?.length} blocks`);
  const media = one("SELECT m.id, m.sha256 FROM content_blocks b JOIN media_assets m ON m.id = b.media_asset_id JOIN learning_resources lr ON lr.id = b.resource_id JOIN curriculum_nodes cn ON cn.id = lr.curriculum_node_id WHERE cn.syllabus_version_id = ? LIMIT 1", physics.versionId);
  const file = media ? await call('GET', `/api/learn/media/${media.id}`) : null;
  check('a lesson diagram served from file storage matches its stored checksum', file?.status === 200 && sha256(file.buf) === media.sha256);
  const revision = await call('GET', `/api/learn/topics/${lessonRow.node}/revision`);
  check('revision notes come from stored lessons only', revision.status === 200 && revision.json.lessons.every((l) => n('SELECT COUNT(*) FROM learning_resources WHERE id = ?', l.resourceId) === 1), `${revision.json?.lessons?.length} lessons`);
  const search = await call('GET', '/api/learn/search?q=electric');
  const searchOk = (search.json?.topics ?? []).every((t) => n(`SELECT COUNT(*) FROM curriculum_nodes cn JOIN syllabus_versions v ON v.id = cn.syllabus_version_id WHERE cn.id = ? AND ${VISIBLE}`, t.id) === 1);
  check('search returns only rows of syllabi students may see', search.json?.topics?.length > 0 && searchOk, `${search.json?.topics?.length} matches`);
  const literal = await call('GET', `/api/learn/search?q=${encodeURIComponent('%%')}`);
  check('a typed "%" is treated as text, not as a wildcard', literal.status === 200 && literal.json.topics.length === 0);

  // ------------------------------------------------------------ student tools
  group = 'Student tools';
  await call('PUT', '/api/student/goals', { token: s.token, body: { questionsPerDay: 25, lessonsPerDay: 2 } });
  const goal = one('SELECT questions_per_day AS q, lessons_per_day AS l FROM daily_goals WHERE user_id = ?', s.id);
  check('daily goals are saved', goal?.q === 25 && goal?.l === 2);
  const prefs = await call('PUT', '/api/student/preferences', { token: s.token, body: { examCode: 'CUET_UG', targetYear: 2027, paperIds: [physics.paperId] } });
  check('exam and subject preferences are saved', prefs.status === 200 && one('SELECT exam_code AS e, paper_ids_json AS p FROM student_preferences WHERE user_id = ?', s.id)?.p === JSON.stringify([physics.paperId]));
  const pgPaper = subjects.CUET_PG[0].paperId;
  check('a subject of another exam is refused in preferences', (await call('PUT', '/api/student/preferences', { token: s.token, body: { examCode: 'CUET_UG', targetYear: 2027, paperIds: [pgPaper] } })).status === 422);
  await call('POST', '/api/student/activity', { token: s.token, body: { kind: 'TOPIC_VIEW', nodeId: lessonRow.node } });
  await call('POST', '/api/student/activity', { token: s.token, body: { kind: 'LESSON_VIEW', resourceId: lessonRow.id } });
  const recent = await call('GET', '/api/student/recent', { token: s.token });
  check('opened topics and lessons are recorded and listed as recently viewed', n('SELECT COUNT(*) FROM learning_activity WHERE user_id = ?', s.id) === 2 && recent.json?.length === 2);
  const aQuestion = one('SELECT qt.question_id AS id FROM question_topics qt JOIN curriculum_nodes cn ON cn.id = qt.curriculum_node_id WHERE cn.syllabus_version_id = ? LIMIT 1', physics.versionId).id;
  for (const b of [{ kind: 'TOPIC', entityId: lessonRow.node }, { kind: 'LESSON', entityId: lessonRow.id }, { kind: 'QUESTION', entityId: aQuestion }]) await call('POST', '/api/student/bookmarks', { token: s.token, body: b });
  const afterAdd = n('SELECT COUNT(*) FROM bookmarks WHERE user_id = ?', s.id);
  await call('POST', '/api/student/bookmarks/remove', { token: s.token, body: { kind: 'QUESTION', entityId: aQuestion } });
  const marks = await call('GET', '/api/student/bookmarks', { token: s.token });
  check('bookmarks are added, removed and listed', afterAdd === 3 && n('SELECT COUNT(*) FROM bookmarks WHERE user_id = ?', s.id) === 2 && marks.json?.length === 2);
  const plan = await call('POST', '/api/student/plan', { token: s.token, body: { day: localDay(), kind: 'CUSTOM', title: 'Trace: revise electrostatics' } });
  const planId = plan.json?.id;
  await call('PATCH', `/api/student/plan/${planId}`, { token: s.token, body: { done: true } });
  const done = one('SELECT done FROM study_plan_items WHERE id = ?', planId)?.done;
  const other = await account('other');
  const cross = (await call('PATCH', `/api/student/plan/${planId}`, { token: other.token, body: { done: false } })).status;
  await call('DELETE', `/api/student/plan/${planId}`, { token: s.token });
  check('a plan item is created, ticked and deleted', plan.status === 201 && done === 1 && n('SELECT COUNT(*) FROM study_plan_items WHERE id = ?', planId) === 0);
  check('another student cannot change that plan item', cross === 404, `status ${cross}`);

  // ------------------------------------------------------------ practice, tests and results
  group = 'Practice and tests';
  const practice = await call('POST', '/api/student/practice', { token: s.token, body: { mode: 'PRACTICE', paperId: physics.paperId, count: 5 } });
  const pq = practice.json.questions[0];
  const fb = await call('POST', `/api/student/practice/${practice.json.session.id}/answers`, { token: s.token, body: { questionId: pq.id, selectedPositions: keyOf(pq.id) } });
  const stored = one('SELECT outcome FROM practice_answers WHERE session_id = ? AND question_id = ?', practice.json.session.id, pq.id);
  check('a practice answer is marked from the stored answer key and saved', practice.status === 201 && fb.json?.outcome === 'CORRECT' && stored?.outcome === 'CORRECT');
  const test = await call('POST', '/api/student/practice', { token: s.token, body: { mode: 'TOPIC_TEST', paperId: physics.paperId } });
  const tq = test.json.questions;
  check('a topic test starts timed, with answers hidden', test.status === 201 && tq.length === 15 && test.json.session.durationSeconds > 0 && tq.every((q) => q.review === null));
  const tfb = await call('POST', `/api/student/practice/${test.json.session.id}/answers`, { token: s.token, body: { questionId: tq[0].id, selectedPositions: keyOf(tq[0].id) } });
  check('no answer key is revealed while a test is running', tfb.status === 200 && tfb.json.correctOptionPositions === undefined && tfb.json.outcome === undefined);
  await call('POST', `/api/student/practice/${test.json.session.id}/answers`, { token: s.token, body: { questionId: tq[1].id, selectedPositions: wrongFor(tq[1]) } });
  const tdone = await call('POST', `/api/student/practice/${test.json.session.id}/submit`, { token: s.token });
  const trow = one('SELECT status, score, correct_count AS c, incorrect_count AS w, unattempted_count AS u FROM practice_sessions WHERE id = ?', test.json.session.id);
  check('submitting a test stores the score the API reports', trow.status === 'SUBMITTED' && trow.score === tdone.json.session.result.score && trow.c === 1 && trow.w === 1 && trow.u === 13, `score ${trow.score}`);
  check('after submission every question shows its answer and explanation', tdone.json.questions.every((q) => q.review !== null));
  check("another student cannot open that result", (await call('GET', `/api/student/practice/${test.json.session.id}`, { token: other.token })).status === 404);

  const rules = JSON.parse(one("SELECT c.rules_json AS r FROM exam_cycles c JOIN exams e ON e.id = c.exam_id WHERE e.code = 'CUET_UG' AND c.year = 2026").r ?? '{}');
  const mock = await call('POST', '/api/student/practice', { token: s.token, body: { mode: 'MOCK_TEST', paperId: physics.paperId } });
  const mq = mock.json.questions;
  const m = mock.json.session;
  check('a mock test follows the exam rules stored for the cycle', mq.length === (rules.questionsPerPaper ?? 50) && m.marking.correct === (rules.marksCorrect ?? m.marking.correct) && m.durationSeconds === (rules.durationMinutes ? rules.durationMinutes * 60 : m.durationSeconds), `${mq.length} questions, ${m.durationSeconds / 60} min, +${m.marking.correct} ${m.marking.incorrect}`);
  for (let i = 0; i < 3; i++) await call('POST', `/api/student/practice/${m.id}/answers`, { token: s.token, body: { questionId: mq[i].id, selectedPositions: keyOf(mq[i].id) } });
  for (let i = 3; i < 6; i++) await call('POST', `/api/student/practice/${m.id}/answers`, { token: s.token, body: { questionId: mq[i].id, selectedPositions: wrongFor(mq[i]) } });
  const mdone = await call('POST', `/api/student/practice/${m.id}/submit`, { token: s.token });
  const expected = 3 * m.marking.correct + 3 * m.marking.incorrect;
  check('the mock score equals the marking scheme applied to the answers', mdone.json.session.result.score === expected && one('SELECT score FROM practice_sessions WHERE id = ?', m.id).score === expected, `score ${mdone.json?.session?.result?.score}, expected ${expected}`);
  const progress = await call('GET', '/api/student/progress', { token: s.token });
  const tp = one('SELECT COALESCE(SUM(correct),0) AS c FROM topic_progress WHERE user_id = ?', s.id);
  check('progress totals equal the stored attempts', progress.json?.totals?.sessions === n("SELECT COUNT(*) FROM practice_sessions WHERE user_id = ? AND status = 'SUBMITTED'", s.id) && progress.json.topics.reduce((a, t) => a + t.correct, 0) === tp.c, `${progress.json?.totals?.sessions} submitted`);
  const dash = await call('GET', `/api/student/dashboard?day=${localDay()}&since=${encodeURIComponent(startOfToday())}`, { token: s.token });
  const answeredToday = n('SELECT COUNT(*) FROM practice_answers a JOIN practice_sessions ps ON ps.id = a.session_id WHERE ps.user_id = ?', s.id);
  check('the Today page shows today\'s answers, the goal and the bookmark count from the database', dash.json?.today?.questionsAnswered === answeredToday && dash.json.today.goal.questionsPerDay === 25 && dash.json.bookmarks === 2, `${answeredToday} answers`);
  const daily = await call('POST', '/api/student/practice/daily', { token: s.token, body: {} });
  check('daily practice starts an untimed set from the preferred subject', daily.status === 201 && daily.json.questions.length === 10 && daily.json.session.durationSeconds === null && one('SELECT test_paper_id AS p FROM practice_sessions WHERE id = ?', daily.json.session.id).p === physics.paperId);
  const d0 = new Date();
  d0.setDate(d0.getDate() - ((d0.getDay() + 6) % 7));
  d0.setHours(0, 0, 0, 0);
  const weekStart = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`;
  const weekly = await call('GET', `/api/student/report/weekly?start=${weekStart}&from=${encodeURIComponent(d0.toISOString())}&tz=${-d0.getTimezoneOffset()}`, { token: s.token });
  check('the weekly report counts this week\'s answers', weekly.status === 200 && weekly.json.totals.answered === answeredToday, `${weekly.json?.totals?.answered} answers`);
  const rem = await call('GET', `/api/student/reminders?day=${localDay()}&since=${encodeURIComponent(startOfToday())}`, { token: s.token });
  const first = rem.json?.[0];
  await call('POST', '/api/student/reminders/dismiss', { token: s.token, body: { key: first.key } });
  const rem2 = await call('GET', `/api/student/reminders?day=${localDay()}&since=${encodeURIComponent(startOfToday())}`, { token: s.token });
  check('a dismissed reminder stays dismissed', rem.json.length > 0 && !rem2.json.some((r) => r.key === first.key) && n('SELECT COUNT(*) FROM reminder_dismissals WHERE user_id = ?', s.id) === 1);

  // ------------------------------------------------------------ profile, password and email
  group = 'Profile and email';
  await call('PUT', '/api/student/profile', { token: s.token, body: { displayName: 'Trace Renamed' } });
  check('the display name is updated', one('SELECT display_name AS d FROM users WHERE id = ?', s.id).d === 'Trace Renamed');
  check('a wrong current password is refused with a clear code', (await call('POST', '/api/student/password', { token: s.token, body: { currentPassword: 'wrong-wrong-wrong', newPassword: password() } })).json?.error?.code === 'WRONG_PASSWORD');
  const second = await call('POST', '/api/auth/login', { body: { email: s.email, password: s.pw } });
  const secondToken = /cuet_session=([^;]+)/.exec(second.cookie)?.[1];
  const newPw = password();
  const before = cred.password_hash;
  const changed = await call('POST', '/api/student/password', { token: s.token, body: { currentPassword: s.pw, newPassword: newPw } });
  check('a password change replaces the hash and signs out other devices', changed.json?.changed === true && one('SELECT password_hash AS h FROM user_credentials WHERE user_id = ?', s.id).h !== before && (await call('GET', '/api/student/profile', { token: secondToken })).status === 401 && (await call('GET', '/api/student/profile', { token: s.token })).status === 200);
  check('the new password signs in and the old one does not', (await call('POST', '/api/auth/login', { body: { email: s.email, password: newPw } })).status === 200 && (await call('POST', '/api/auth/login', { body: { email: s.email, password: s.pw } })).status === 401);
  await call('POST', '/api/auth/forgot-password', { body: { email: s.email } });
  await sleep(1500);
  const mail = one("SELECT status, provider FROM email_messages WHERE to_email = ? AND kind = 'PASSWORD_RESET'", s.email);
  check('"forgot password" records one reset email and a hashed one-time link', mail?.status === 'SENT' && n("SELECT COUNT(*) FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL AND created_by = 'self-service:email'", s.id) === 1, `${mail?.status} via ${mail?.provider} (local simulator)`);
  check('the email log never stores a message body', !all('PRAGMA table_info(email_messages)').some((c) => /body|html|text/i.test(c.name)));
  check('email reminders cannot be switched on before the address is confirmed', (await call('PUT', '/api/student/email', { token: s.token, body: { emailReminders: true } })).status === 409);
  const out = await call('POST', '/api/auth/logout', { token: s.token });
  check('sign-out revokes the session', out.status === 200 && one('SELECT revoked_at AS r FROM user_sessions WHERE token_hash = ?', sha256(s.token)).r !== null && (await call('GET', '/api/auth/me', { token: s.token })).json.user === null);

  // ------------------------------------------------------------ public information
  group = 'Public information';
  for (const exam of ['CUET_UG', 'CUET_PG']) {
    const info = await call('GET', `/api/public/info/${exam}`);
    const items = info.json?.sections?.reduce((a, x) => a + x.items.length, 0);
    check(`${exam} information page serves every stored official fact, without sign-in`, info.status === 200 && items === n('SELECT COUNT(*) FROM official_info_items WHERE exam_code = ?', exam), `${items} facts`);
  }
  const uni = await call('GET', '/api/public/universities?exam=CUET_UG');
  check('university list total matches the database', uni.json?.total === n("SELECT COUNT(*) FROM participating_universities WHERE exam_code = 'CUET_UG'"), `${uni.json?.total} universities`);
  const uniQ = await call('GET', '/api/public/universities?exam=CUET_UG&q=delhi');
  check('university search filters by name', uniQ.json?.universities?.length > 0 && uniQ.json.universities.every((u) => /delhi/i.test(`${u.name} ${u.state ?? ''}`)), `${uniQ.json?.universities?.length} matches`);

  // ------------------------------------------------------------ reviewer
  group = 'Reviewer';
  const r = await account('reviewer');
  check('a student is refused in the reviewer area', (await call('GET', '/api/review/me', { token: r.token })).status === 403);
  const grant = await admin('POST', '/api/admin/users/roles', { email: r.email, role: 'REVIEWER' });
  check('granting the reviewer role is stored', grant.status === 200 && n("SELECT COUNT(*) FROM user_roles ur JOIN roles ro ON ro.id = ur.role_id WHERE ur.user_id = ? AND ro.code = 'REVIEWER'", r.id) === 1);
  const rme = await call('GET', '/api/review/me', { token: r.token });
  check('the reviewer now holds the review permission', rme.status === 200 && rme.json.permissions.includes('content:review'));
  const ws = await call('GET', `/api/review/papers/${physics.paperId}`, { token: r.token });
  check('the reviewer workspace opens the paper with its rows', ws.status === 200 && JSON.stringify(ws.json).includes(physics.versionId));
  const pdf = await call('GET', `/api/review/sources/${src.id}/file`, { token: r.token });
  check('the official PDF served to the reviewer matches its stored checksum', pdf.status === 200 && sha256(pdf.buf) === src.sha256, `${pdf.buf.length} bytes`);
  const [q1, q2] = all('SELECT qt.question_id AS id FROM question_topics qt JOIN curriculum_nodes cn ON cn.id = qt.curriculum_node_id WHERE cn.syllabus_version_id = ? ORDER BY qt.question_id LIMIT 2', physics.versionId).map((x) => x.id);
  check('approval without a ticked checklist is refused', (await call('POST', '/api/review/decide', { token: r.token, body: { entityType: 'QUESTION', entityIds: [q1], action: 'VERIFIED' } })).status >= 400);
  const ok = await call('POST', '/api/review/decide', { token: r.token, body: { entityType: 'QUESTION', entityIds: [q1], action: 'VERIFIED', checklist: { matchesSyllabus: true, answerKeyCorrect: true, explanationCorrect: true, clearForStudents: true } } });
  check('a reviewer approval is stored as VERIFIED with a record under their own account', ok.status === 200 && one('SELECT verification AS v FROM questions WHERE id = ?', q1).v === 'VERIFIED' && n("SELECT COUNT(*) FROM review_records WHERE entity_type = 'QUESTION' AND entity_id = ? AND action = 'VERIFIED' AND actor = ?", q1, `user:${r.id}`) === 1, `status ${ok.status}`);
  check('rejecting without a comment is refused', (await call('POST', '/api/review/decide', { token: r.token, body: { entityType: 'QUESTION', entityIds: [q2], action: 'REJECTED' } })).status >= 400);
  const rej = await call('POST', '/api/review/decide', { token: r.token, body: { entityType: 'QUESTION', entityIds: [q2], action: 'REJECTED', comment: 'Trace: rejected to test the flow' } });
  check('a rejection is stored with its comment', rej.status === 200 && one('SELECT verification AS v FROM questions WHERE id = ?', q2).v === 'REJECTED' && n("SELECT COUNT(*) FROM review_records WHERE entity_id = ? AND action = 'REJECTED' AND comment LIKE 'Trace:%'", q2) === 1);
  const q3 = one("SELECT id FROM questions WHERE verification = 'UNVERIFIED' LIMIT 1").id;
  const bad = await admin('POST', '/api/admin/review', { entityType: 'QUESTION', entityIds: [q3], action: 'VERIFIED' });
  check('the shared admin token cannot mark anything approved', bad.status === 403 && bad.json?.error?.code === 'HUMAN_REVIEW_REQUIRED' && one('SELECT verification AS v FROM questions WHERE id = ?', q3).v === 'UNVERIFIED');

  // ------------------------------------------------------------ admin
  group = 'Admin';
  check('the import API refuses a missing or wrong token', (await call('GET', '/api/admin/overview')).status === 401 && (await call('GET', '/api/admin/overview', { headers: { 'x-admin-token': 'wrong' } })).status === 401);
  check('a student session is not accepted by the import API', (await call('GET', '/api/admin/overview', { token: other.token })).status === 401);
  const list = await admin('GET', '/api/admin/questions?pageSize=1');
  check('the admin question total matches the database', list.json?.total === n('SELECT COUNT(*) FROM questions'), `${list.json?.total} questions`);
  check('a student is refused in the admin console', (await call('GET', '/api/console/overview', { token: other.token })).status === 403);
  const a = await account('admin');
  await admin('POST', '/api/admin/users/roles', { email: a.email, role: 'SUPER_ADMIN' });
  check('an administrator opens the console overview and the email log', (await call('GET', '/api/console/overview', { token: a.token })).status === 200 && (await call('GET', '/api/console/email', { token: a.token })).json?.enabled === true);
  const found = await call('GET', `/api/console/students?q=${encodeURIComponent(other.email)}`, { token: a.token });
  check('student search finds the account', JSON.stringify(found.json).includes(other.id));
  const sus = await call('POST', `/api/console/students/${other.id}/status`, { token: a.token, body: { status: 'DISABLED', reason: 'Trace' } });
  const blocked = (await call('GET', '/api/student/profile', { token: other.token })).status;
  const noLogin = (await call('POST', '/api/auth/login', { body: { email: other.email, password: other.pw } })).status;
  check('suspending an account signs it out and blocks sign-in', sus.status === 200 && one('SELECT status FROM users WHERE id = ?', other.id).status === 'DISABLED' && blocked === 401 && noLogin === 401);
  await call('POST', `/api/console/students/${other.id}/status`, { token: a.token, body: { status: 'ACTIVE' } });
  check('restoring the account lets it sign in again', (await call('POST', '/api/auth/login', { body: { email: other.email, password: other.pw } })).status === 200);
  check('console actions are logged under the administrator\'s own account', n('SELECT COUNT(*) FROM audit_logs WHERE actor = ?', `user:${a.id}`) >= 2);
  const link = await call('POST', '/api/console/students/reset-link', { token: a.token, body: { email: other.email } });
  check('an administrator can create a one-time reset link (only its hash is stored)', link.status === 201 && n('SELECT COUNT(*) FROM password_reset_tokens WHERE token_hash = ?', sha256(link.json.path.split('#')[1])) === 1);

  // ------------------------------------------------------------ plans and payments (built-in test gateway; no money, no outside calls)
  group = 'Plans and payments';
  const outsider = await account('outsider'); // a fresh student: the earlier one was signed out when it was suspended
  const plansBefore = await call('GET', '/api/public/plans');
  check('only plans switched on by an administrator are offered, with prices from the database', plansBefore.status === 200 && plansBefore.json.plans.length === n('SELECT COUNT(*) FROM plans WHERE active = 1'), `${plansBefore.json?.plans?.length} on offer`);
  const monthly = one("SELECT id FROM plans WHERE code = 'MONTHLY'");
  const planBody = { name: '1 month', description: null, pricePaise: 49900, durationDays: 30, active: true, sortOrder: 1, limits: {}, features: [] };
  check('a student cannot change plans or prices', (await call('PUT', `/api/console/billing/plans/${monthly.id}`, { token: outsider.token, body: planBody })).status === 403);
  check('a paid plan cannot be offered at a price of zero', (await call('PUT', `/api/console/billing/plans/${monthly.id}`, { token: a.token, body: { ...planBody, pricePaise: 0 } })).status === 422);
  const priced = await call('PUT', `/api/console/billing/plans/${monthly.id}`, { token: a.token, body: planBody });
  check('an administrator sets the price and the change is logged', priced.status === 200 && one("SELECT price_paise AS p FROM plans WHERE code = 'MONTHLY'").p === 49900 && n("SELECT COUNT(*) FROM audit_logs WHERE action = 'UPDATE_PLAN' AND actor = ?", `user:${a.id}`) === 1);
  const buyer = await account('buyer');
  const order = await call('POST', '/api/student/billing/orders', { token: buyer.token, body: { planCode: 'MONTHLY' } });
  const orderRow = one('SELECT amount_paise AS amt, status, gateway FROM payment_orders WHERE id = ?', order.json?.orderId);
  check('an order copies the plan price at the moment of ordering', order.status === 201 && orderRow?.amt === 49900 && orderRow.status === 'CREATED' && orderRow.gateway === 'mock');
  check("another student cannot pay or see that order", (await call('POST', `/api/student/billing/orders/${order.json.orderId}/simulate`, { token: outsider.token, body: { outcome: 'success' } })).status === 404);
  const failedPay = await call('POST', `/api/student/billing/orders/${order.json.orderId}/simulate`, { token: buyer.token, body: { outcome: 'failure' } });
  check('a failed payment gives no access', failedPay.json?.result === 'FAILED' && n('SELECT COUNT(*) FROM subscriptions WHERE user_id = ?', buyer.id) === 0 && one('SELECT status FROM payment_orders WHERE id = ?', order.json.orderId).status === 'FAILED');
  const order2 = await call('POST', '/api/student/billing/orders', { token: buyer.token, body: { planCode: 'MONTHLY' } });
  const paidPay = await call('POST', `/api/student/billing/orders/${order2.json.orderId}/simulate`, { token: buyer.token, body: { outcome: 'success' } });
  const pass = one('SELECT status, starts_at, ends_at FROM subscriptions WHERE order_id = ?', order2.json.orderId);
  const passDays = pass ? Math.round((new Date(pass.ends_at) - new Date(pass.starts_at)) / 86400000) : 0;
  check('a successful payment marks the order paid and gives 30 days of access', paidPay.json?.result === 'PAID' && one('SELECT status FROM payment_orders WHERE id = ?', order2.json.orderId).status === 'PAID' && pass?.status === 'ACTIVE' && passDays === 30, `${passDays} days`);
  await call('POST', `/api/student/billing/orders/${order2.json.orderId}/simulate`, { token: buyer.token, body: { outcome: 'success' } });
  check('a repeated payment report never gives a second pass', n('SELECT COUNT(*) FROM subscriptions WHERE user_id = ?', buyer.id) === 1);
  const bill = await call('GET', '/api/student/billing', { token: buyer.token });
  check('the student sees the plan, the end date and both payment attempts', bill.json?.access?.paid === true && bill.json.payments.length === 2 && bill.json.access.plan.code === 'MONTHLY');
  const freePlan = one("SELECT id FROM plans WHERE is_free = 1");
  await call('PUT', `/api/console/billing/plans/${freePlan.id}`, { token: a.token, body: { name: 'Free', description: null, pricePaise: 0, durationDays: null, active: true, sortOrder: 0, limits: { mockTests: 0 }, features: [] } });
  const limited = await call('POST', '/api/student/practice', { token: outsider.token, body: { mode: 'MOCK_TEST', paperId: physics.paperId } });
  const unlimited = await call('POST', '/api/student/practice', { token: buyer.token, body: { mode: 'MOCK_TEST', paperId: physics.paperId } });
  check('a plan limit stops a free student (402) and not a paid student', limited.status === 402 && limited.json.error.code === 'PLAN_LIMIT' && unlimited.status === 201);
  check('the payment webhook address does not exist for the test gateway', (await call('POST', '/api/public/payments/webhooks/razorpay', { body: { event: 'payment.captured' } })).status === 404);
  check('no payment record holds card, bank or UPI details', !['payment_orders', 'payment_transactions', 'payment_events'].some((t) => all(`PRAGMA table_info(${t})`).some((c) => /card|vpa|upi_id|bank|account|cvv|contact|email/i.test(c.name))));

  // ------------------------------------------------------------ previous-year papers (a made-up sample paper; nothing real is imported)
  group = 'Previous-year papers';
  const emptyList = await call('GET', '/api/learn/past-papers?exam=CUET_UG');
  check('no previous-year paper is shown while none is published', emptyList.status === 200 && emptyList.json.papers.length === 0 && n('SELECT COUNT(*) FROM past_papers') === 0);
  const ppSrc = (d, title) => ({ title, publisher: 'Trace Board', url: `https://example.test/${d}.pdf`, retrievedAt: '2026-11-13T00:00:00.000Z', sha256: d.repeat(64), byteSize: 1000, mimeType: 'application/pdf', pageCount: 2 });
  const ppQ = (position, key, official = key) => ({ position, type: 'MCQ_SINGLE', stem: `Trace sample question ${position}: choose the option the sample key marks correct.`, sourcePage: 1, options: ['A', 'B', 'C', 'D'].map((l) => ({ label: l, text: `Option ${l} of question ${position}` })), correctOptionPositions: [key], officialKey: [official] });
  const samplePack = (questions) => ({ schema: 'cuet-past-paper/1', exam: 'CUET_UG', year: 2025, subjectCode: '322', subjectName: 'Physics', examDate: '2025-05-20', shift: 'Shift 1', language: 'en', title: 'Trace sample paper', rules: { questionsInPaper: 4, durationMinutes: 8, marksCorrect: 5, marksIncorrect: -1 }, usagePermission: 'OWNED_ORIGINAL', questionPaperSource: ppSrc('5', 'Trace sample paper'), answerKeySource: ppSrc('6', 'Trace sample key'), keyVersion: 'FINAL', questions });
  const wrongKey = await admin('POST', '/api/admin/past-papers', samplePack([ppQ(1, 1, 2), ppQ(2, 2), ppQ(4, 4)]));
  check('an import is refused when a key differs from the official key or a question is unaccounted for', wrongKey.status === 422 && wrongKey.json.error.details.errors.length === 2 && n('SELECT COUNT(*) FROM past_papers') === 0, wrongKey.json?.error?.details?.errors?.join(' | ').slice(0, 120));
  const imported = await admin('POST', '/api/admin/past-papers', samplePack([ppQ(1, 1), ppQ(2, 2), { position: 3, dropped: true }, ppQ(4, 4)]));
  const ppId = imported.json?.id;
  const ppRow = one('SELECT status, question_paper_source_id AS src FROM past_papers WHERE id = ?', ppId);
  check('a valid paper is stored as a draft with its source document', imported.json?.outcome === 'CREATED' && ppRow?.status === 'DRAFT' && n('SELECT COUNT(*) FROM source_documents WHERE id = ?', ppRow.src) === 1 && n('SELECT COUNT(*) FROM past_paper_questions WHERE past_paper_id = ?', ppId) === 4);
  check('a draft paper is hidden from students and its questions are outside ordinary practice', (await call('GET', `/api/learn/past-papers/${ppId}`)).status === 404 && n("SELECT COUNT(*) FROM questions WHERE external_key LIKE 'pyq:%' AND test_paper_id IS NOT NULL") === 0);
  const early = await call('POST', `/api/console/past-papers/${ppId}/status`, { token: a.token, body: { action: 'PUBLISH' } });
  check('publishing is refused until a reviewer has verified every question', early.status === 409 && /not yet verified by a reviewer/.test(JSON.stringify(early.json)));
  const ppQuestions = all('SELECT question_id AS id FROM past_paper_questions WHERE past_paper_id = ? AND question_id IS NOT NULL', ppId).map((x) => x.id);
  await call('POST', '/api/review/decide', { token: r.token, body: { entityType: 'QUESTION', entityIds: ppQuestions, action: 'VERIFIED', checklist: { matchesSource: true } } });
  const pub = await call('POST', `/api/console/past-papers/${ppId}/status`, { token: a.token, body: { action: 'PUBLISH' } });
  const shown = await call('GET', '/api/learn/past-papers?exam=CUET_UG&year=2025&subject=322');
  check('after review a member of staff publishes it and students can find it by exam, year and subject', pub.json?.status === 'PUBLISHED' && shown.json?.papers?.length === 1 && shown.json.papers[0].dropped === 1, `${shown.json?.papers?.length} paper`);
  const attempt = await call('POST', `/api/student/past-papers/${ppId}/start`, { token: buyer.token, body: { mode: 'MOCK_TEST' } });
  check('a paper is attempted with its own questions, order, time and marking', attempt.status === 201 && attempt.json.questions.length === 3 && attempt.json.session.durationSeconds === 360 && attempt.json.session.marking.correct === 5 && attempt.json.questions[2].stem.includes('question 4'));

  // ------------------------------------------------------------ integrity
  group = 'Integrity';
  check('no foreign-key violations after all of the above', all('PRAGMA foreign_key_check').length === 0);
  check('nothing is marked approved without a signed-in reviewer\'s record', n("SELECT COUNT(*) FROM questions q WHERE q.verification = 'VERIFIED' AND NOT EXISTS (SELECT 1 FROM review_records r WHERE r.entity_id = q.id AND r.action = 'VERIFIED' AND r.actor LIKE 'user:%')") === 0 && n("SELECT COUNT(*) FROM learning_resources WHERE verification = 'VERIFIED'") === 0);
  check('every machine-checked syllabus version has its evidence record', n("SELECT COUNT(*) FROM syllabus_versions v WHERE v.verification = 'MACHINE_VERIFIED' AND NOT EXISTS (SELECT 1 FROM verification_evidence e WHERE e.entity_id = v.id)") === 0);
}

let failed = false;
try {
  await run();
} catch (e) {
  failed = true;
  console.error(`\nThe trace stopped early: ${e.stack ?? e}`);
  console.error(serverLog.split('\n').filter((l) => /error|✘/i.test(l)).slice(-5).join('\n'));
} finally {
  try {
    db?.close();
  } catch {
    /* ignore */
  }
  stopServer();
  await sleep(2500);
  try {
    rmSync(copy, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
  } catch (e) {
    console.error(`Could not delete the throwaway copy at ${copy}: ${e.message}`);
  }
}
const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed} of ${results.length} checks passed${failed ? ' (stopped early)' : ''}. Throwaway copy deleted: ${!existsSync(copy)}`);
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify({ ranAt: new Date().toISOString(), passed, total: results.length, stoppedEarly: failed, results }, null, 1));
process.exitCode = failed || passed !== results.length ? 1 : 0;
