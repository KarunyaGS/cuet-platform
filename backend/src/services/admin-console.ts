/**
 * Admin console and reviewer content review: dashboard figures, student management, staff and roles,
 * activity log, lesson/question lists and reviewer assignments. Every write is recorded in audit_logs
 * under the signed-in person (`user:<id>`).
 */
import { z } from 'zod';
import { ApiError, invalid, notFound } from '../lib/errors';
import { newId } from '../lib/hash';
import { nowIso } from '../lib/sql';

export interface Staff {
  id: string;
  displayName: string;
  permissions: string[];
}
export function needPermission(user: Staff, permission: string, what: string) {
  if (!user.permissions.includes(permission)) throw new ApiError(403, 'FORBIDDEN', `Your role does not allow you to ${what}`);
}
const audit = (db: D1Database, actor: string, action: string, entityType: string, entityId: string, detail?: unknown) =>
  db
    .prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('aud'), actor, action, entityType, entityId, detail === undefined ? null : JSON.stringify(detail), nowIso());
const paging = (page: number, pageSize: number) => ({ limit: pageSize, offset: (page - 1) * pageSize });
export const pageQuery = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) });

// ---------------------------------------------------------------- dashboard

export async function consoleOverview(db: D1Database) {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [counts, content, syllabus, recent] = await Promise.all([
    db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM users u WHERE EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.code = 'STUDENT')) AS students,
          (SELECT COUNT(*) FROM users WHERE created_at >= ?1) AS new_accounts_7d,
          (SELECT COUNT(DISTINCT user_id) FROM practice_sessions WHERE started_at >= ?1) AS active_students_7d,
          (SELECT COUNT(*) FROM users WHERE status = 'DISABLED') AS suspended,
          (SELECT COUNT(*) FROM practice_sessions WHERE status = 'SUBMITTED') AS tests_submitted,
          (SELECT COUNT(*) FROM practice_sessions WHERE status = 'SUBMITTED' AND submitted_at >= ?1) AS tests_submitted_7d,
          (SELECT COUNT(*) FROM practice_answers WHERE answered_at >= ?1) AS answers_7d,
          (SELECT COUNT(*) FROM review_records WHERE actor LIKE 'user:%' AND action IN ('VERIFIED','CHANGES_REQUESTED','REJECTED')) AS human_decisions`,
      )
      .bind(weekAgo)
      .first<Record<string, number>>(),
    db
      .prepare(
        `SELECT 'QUESTION' AS type, status, verification, COUNT(*) AS n FROM questions GROUP BY status, verification
         UNION ALL SELECT 'LESSON', status, verification, COUNT(*) FROM learning_resources GROUP BY status, verification`,
      )
      .all<{ type: string; status: string; verification: string; n: number }>(),
    db
      .prepare(
        `SELECT e.code AS exam, COUNT(*) AS papers,
           SUM(EXISTS (SELECT 1 FROM syllabus_versions v WHERE v.test_paper_id = p.id AND v.status != 'ARCHIVED' AND v.verification = 'VERIFIED')) AS human_verified,
           SUM(EXISTS (SELECT 1 FROM syllabus_versions v WHERE v.test_paper_id = p.id AND v.status != 'ARCHIVED' AND v.verification = 'MACHINE_VERIFIED')) AS machine_verified,
           SUM(EXISTS (SELECT 1 FROM questions q WHERE q.test_paper_id = p.id)) AS with_questions
         FROM test_papers p JOIN exam_cycles c ON c.id = p.exam_cycle_id JOIN exams e ON e.id = c.exam_id GROUP BY e.code ORDER BY e.code DESC`,
      )
      .all<Record<string, string | number>>(),
    activity(db, { page: 1, pageSize: 8 }),
  ]);
  return { counts, content: content.results, syllabus: syllabus.results, recentActivity: recent.items };
}

// ---------------------------------------------------------------- students

export const studentQuery = pageQuery.extend({ q: z.string().trim().max(100).optional(), status: z.enum(['ACTIVE', 'DISABLED']).optional() });

export async function listStudents(db: D1Database, f: z.infer<typeof studentQuery>) {
  const where = ['1 = 1'];
  const params: (string | number)[] = [];
  if (f.q) {
    where.push("(u.email LIKE '%' || ? || '%' OR u.display_name LIKE '%' || ? || '%')");
    params.push(f.q, f.q);
  }
  if (f.status) {
    where.push('u.status = ?');
    params.push(f.status);
  }
  const { limit, offset } = paging(f.page, f.pageSize);
  const [total, rows] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n FROM users u WHERE ${where.join(' AND ')}`).bind(...params).first<{ n: number }>(),
    db
      .prepare(
        `SELECT u.id, u.email, u.display_name, u.status, u.created_at, u.last_login_at,
           (SELECT GROUP_CONCAT(r.code) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id) AS roles,
           (SELECT COUNT(*) FROM practice_sessions s WHERE s.user_id = u.id AND s.status = 'SUBMITTED') AS tests,
           (SELECT MAX(started_at) FROM practice_sessions s WHERE s.user_id = u.id) AS last_practice
         FROM users u WHERE ${where.join(' AND ')} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      )
      .bind(...params, limit, offset)
      .all<Record<string, string | number | null>>(),
  ]);
  return {
    total: total?.n ?? 0,
    items: rows.results.map((r) => ({ id: r.id, email: r.email, displayName: r.display_name, status: r.status, createdAt: r.created_at, lastLoginAt: r.last_login_at, roles: String(r.roles ?? '').split(',').filter(Boolean), tests: Number(r.tests), lastPractice: r.last_practice })),
  };
}

export async function studentDetail(db: D1Database, id: string) {
  const u = await db
    .prepare(`SELECT u.id, u.email, u.display_name, u.status, u.created_at, u.last_login_at, (SELECT GROUP_CONCAT(r.code) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id) AS roles FROM users u WHERE u.id = ?`)
    .bind(id)
    .first<Record<string, string | null>>();
  if (!u) throw notFound('Account');
  const [totals, sessions, subjects, prefs, extras] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS sessions, COALESCE(SUM(correct_count),0) AS correct, COALESCE(SUM(incorrect_count),0) AS incorrect FROM practice_sessions WHERE user_id = ? AND status = 'SUBMITTED'`).bind(id).first<{ sessions: number; correct: number; incorrect: number }>(),
    db
      .prepare(`SELECT s.id, s.mode, s.status, s.score, s.max_score, s.started_at, p.name AS paper FROM practice_sessions s LEFT JOIN test_papers p ON p.id = s.test_paper_id WHERE s.user_id = ? ORDER BY s.started_at DESC LIMIT 15`)
      .bind(id)
      .all<Record<string, string | number | null>>(),
    db
      .prepare(
        `SELECT p.name AS paper, p.code, SUM(tp.attempted) AS attempted, SUM(tp.correct) AS correct FROM topic_progress tp JOIN curriculum_nodes n ON n.id = tp.curriculum_node_id JOIN syllabus_versions v ON v.id = n.syllabus_version_id JOIN test_papers p ON p.id = v.test_paper_id
         WHERE tp.user_id = ? GROUP BY p.id ORDER BY attempted DESC`,
      )
      .bind(id)
      .all<{ paper: string; code: string; attempted: number; correct: number }>(),
    db.prepare('SELECT exam_code, target_year, paper_ids_json FROM student_preferences WHERE user_id = ?').bind(id).first<{ exam_code: string | null; target_year: number | null; paper_ids_json: string }>(),
    db
      .prepare(`SELECT (SELECT COUNT(*) FROM bookmarks WHERE user_id = ?1) AS bookmarks, (SELECT COUNT(*) FROM study_plan_items WHERE user_id = ?1) AS plan_items, (SELECT COUNT(*) FROM user_sessions WHERE user_id = ?1 AND revoked_at IS NULL AND expires_at > ?2) AS open_sessions`)
      .bind(id, nowIso())
      .first<{ bookmarks: number; plan_items: number; open_sessions: number }>(),
  ]);
  const answered = (totals?.correct ?? 0) + (totals?.incorrect ?? 0);
  return {
    id: u.id, email: u.email, displayName: u.display_name, status: u.status, createdAt: u.created_at, lastLoginAt: u.last_login_at, roles: String(u.roles ?? '').split(',').filter(Boolean),
    totals: { sessions: totals?.sessions ?? 0, answered, accuracy: answered ? Math.round((1000 * (totals?.correct ?? 0)) / answered) / 10 : null },
    preferences: prefs ? { examCode: prefs.exam_code, targetYear: prefs.target_year, subjects: (JSON.parse(prefs.paper_ids_json) as string[]).length } : null,
    subjects: subjects.results.map((s) => ({ ...s, accuracy: s.attempted ? Math.round((1000 * s.correct) / s.attempted) / 10 : null })),
    recentSessions: sessions.results,
    bookmarks: extras?.bookmarks ?? 0, planItems: extras?.plan_items ?? 0, openSessions: extras?.open_sessions ?? 0,
  };
}

export const statusSchema = z.object({ status: z.enum(['ACTIVE', 'DISABLED']), reason: z.string().trim().max(500).optional() });

/** Suspends or restores an account. Suspending signs the account out everywhere; nothing is deleted. */
export async function setStudentStatus(db: D1Database, id: string, input: z.infer<typeof statusSchema>, staff: Staff) {
  needPermission(staff, 'users:manage', 'suspend or restore accounts');
  if (id === staff.id) throw invalid('You cannot suspend your own account');
  const u = await db.prepare('SELECT status FROM users WHERE id = ?').bind(id).first<{ status: string }>();
  if (!u) throw notFound('Account');
  const now = nowIso();
  await db.batch([
    db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').bind(input.status, now, id),
    ...(input.status === 'DISABLED' ? [db.prepare('UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').bind(now, id)] : []),
    audit(db, `user:${staff.id}`, input.status === 'DISABLED' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_RESTORED', 'USER', id, { reason: input.reason ?? null }),
  ]);
  return { id, status: input.status };
}

// ---------------------------------------------------------------- staff and roles

export async function listStaff(db: D1Database) {
  const [staff, roles] = await Promise.all([
    db
      .prepare(
        `SELECT u.id, u.email, u.display_name, u.status, u.last_login_at, GROUP_CONCAT(r.code) AS roles,
           (SELECT COUNT(*) FROM review_records rr WHERE rr.actor = 'user:' || u.id) AS decisions
         FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
         WHERE r.code NOT IN ('STUDENT','PARENT') GROUP BY u.id ORDER BY u.display_name`,
      )
      .all<Record<string, string | number | null>>(),
    db
      .prepare(
        `SELECT r.code, r.name, (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) AS members,
           (SELECT GROUP_CONCAT(p.code) FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = r.id) AS permissions
         FROM roles r ORDER BY members DESC`,
      )
      .all<Record<string, string | number | null>>(),
  ]);
  return {
    staff: staff.results.map((s) => ({ id: s.id, email: s.email, displayName: s.display_name, status: s.status, lastLoginAt: s.last_login_at, roles: String(s.roles ?? '').split(','), decisions: Number(s.decisions) })),
    roles: roles.results.map((r) => ({ code: r.code, name: r.name, members: Number(r.members), permissions: String(r.permissions ?? '').split(',').filter(Boolean).sort() })),
  };
}

// ---------------------------------------------------------------- activity

export const activityQuery = pageQuery.extend({ action: z.string().trim().max(60).optional(), actor: z.string().trim().max(120).optional() });

export async function activity(db: D1Database, f: z.infer<typeof activityQuery>) {
  const where = ['1 = 1'];
  const params: (string | number)[] = [];
  if (f.action) {
    where.push('a.action = ?');
    params.push(f.action);
  }
  if (f.actor) {
    where.push('a.actor = ?');
    params.push(f.actor);
  }
  const { limit, offset } = paging(f.page, f.pageSize);
  const [total, rows, actions] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n FROM audit_logs a WHERE ${where.join(' AND ')}`).bind(...params).first<{ n: number }>(),
    db
      .prepare(
        `SELECT a.id, a.actor, a.action, a.entity_type, a.entity_id, a.detail_json, a.created_at,
           CASE WHEN a.actor LIKE 'user:%' THEN (SELECT display_name FROM users WHERE id = SUBSTR(a.actor, 6)) END AS actor_name,
           CASE WHEN a.entity_type = 'USER' THEN (SELECT email FROM users WHERE id = a.entity_id) END AS entity_label
         FROM audit_logs a WHERE ${where.join(' AND ')} ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`,
      )
      .bind(...params, limit, offset)
      .all<Record<string, string | null>>(),
    db.prepare('SELECT action, COUNT(*) AS n FROM audit_logs GROUP BY action ORDER BY n DESC LIMIT 40').all<{ action: string; n: number }>(),
  ]);
  return {
    total: total?.n ?? 0,
    actions: actions.results,
    items: rows.results.map((r) => ({ id: r.id, actor: r.actor, actorName: r.actor_name ?? r.actor, action: r.action, entityType: r.entity_type, entityId: r.entity_id, entityLabel: r.entity_label, detail: r.detail_json, createdAt: r.created_at })),
  };
}

// ---------------------------------------------------------------- lessons and questions

export const contentQuery = pageQuery.extend({
  type: z.enum(['QUESTION', 'LEARNING_RESOURCE']),
  paperId: z.string().max(100).optional(),
  verification: z.enum(['UNVERIFIED', 'MACHINE_VERIFIED', 'VERIFIED', 'NEEDS_CHANGES', 'REJECTED']).optional(),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED']).optional(),
  q: z.string().trim().max(100).optional(),
});

/** Lessons or questions with their paper, for the content manager and the reviewer's list. */
export async function listContent(db: D1Database, f: z.infer<typeof contentQuery>) {
  const isQ = f.type === 'QUESTION';
  const from = isQ
    ? `questions x LEFT JOIN test_papers p ON p.id = x.test_paper_id`
    : `learning_resources x LEFT JOIN curriculum_nodes n ON n.id = x.curriculum_node_id LEFT JOIN syllabus_versions v ON v.id = n.syllabus_version_id LEFT JOIN test_papers p ON p.id = COALESCE(x.test_paper_id, v.test_paper_id)`;
  const where = ['1 = 1'];
  const params: (string | number)[] = [];
  if (f.paperId) {
    where.push('p.id = ?');
    params.push(f.paperId);
  }
  if (f.verification) {
    where.push('x.verification = ?');
    params.push(f.verification);
  }
  if (f.status) {
    where.push('x.status = ?');
    params.push(f.status);
  }
  if (f.q) {
    where.push(`${isQ ? 'x.stem' : 'x.title'} LIKE '%' || ? || '%'`);
    params.push(f.q);
  }
  const { limit, offset } = paging(f.page, f.pageSize);
  const [total, rows, byVer] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n FROM ${from} WHERE ${where.join(' AND ')}`).bind(...params).first<{ n: number }>(),
    db
      .prepare(
        `SELECT x.id, ${isQ ? 'SUBSTR(x.stem, 1, 220)' : 'x.title'} AS title, x.type, ${isQ ? 'x.difficulty' : 'NULL'} AS difficulty, x.status, x.verification, x.origin, x.updated_at, p.id AS paper_id, p.code AS paper_code, p.name AS paper
         FROM ${from} WHERE ${where.join(' AND ')} ORDER BY x.updated_at DESC, x.id LIMIT ? OFFSET ?`,
      )
      .bind(...params, limit, offset)
      .all<Record<string, string | null>>(),
    db.prepare(`SELECT verification, COUNT(*) AS n FROM ${isQ ? 'questions' : 'learning_resources'} GROUP BY verification`).all<{ verification: string; n: number }>(),
  ]);
  return {
    total: total?.n ?? 0,
    byVerification: byVer.results,
    items: rows.results.map((r) => ({ id: r.id, title: r.title, type: r.type, difficulty: r.difficulty, status: r.status, verification: r.verification, origin: r.origin, updatedAt: r.updated_at, paperId: r.paper_id, paperCode: r.paper_code, paper: r.paper })),
  };
}

/** Papers that have lessons or questions (for filters). */
export async function contentPapers(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT p.id, p.code, p.name, e.code AS exam FROM test_papers p JOIN exam_cycles c ON c.id = p.exam_cycle_id JOIN exams e ON e.id = c.exam_id
       WHERE EXISTS (SELECT 1 FROM questions q WHERE q.test_paper_id = p.id)
          OR EXISTS (SELECT 1 FROM learning_resources r JOIN curriculum_nodes n ON n.id = r.curriculum_node_id JOIN syllabus_versions v ON v.id = n.syllabus_version_id WHERE v.test_paper_id = p.id)
       ORDER BY e.code DESC, p.name`,
    )
    .all<{ id: string; code: string; name: string; exam: string }>();
  return results;
}

// ---------------------------------------------------------------- reviewer assignments

export const assignmentSchema = z.object({ email: z.email().max(200).transform((e) => e.trim().toLowerCase()), paperId: z.string().min(1).max(100), scope: z.enum(['SYLLABUS', 'CONTENT']), note: z.string().trim().max(500).optional() });

const ASSIGNMENT_SQL = `SELECT a.id, a.scope, a.note, a.created_at, a.user_id, u.display_name, u.email, p.id AS paper_id, p.code AS paper_code, p.name AS paper, e.code AS exam,
    (SELECT COUNT(*) FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id WHERE v.test_paper_id = p.id AND v.status != 'ARCHIVED') AS rows_total,
    (SELECT COUNT(*) FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id WHERE v.test_paper_id = p.id AND v.status != 'ARCHIVED' AND n.verification IN ('VERIFIED','REJECTED')) AS rows_decided,
    (SELECT COUNT(*) FROM questions q WHERE q.test_paper_id = p.id) AS questions_total,
    (SELECT COUNT(*) FROM questions q WHERE q.test_paper_id = p.id AND q.verification IN ('VERIFIED','REJECTED','NEEDS_CHANGES')) AS questions_decided,
    (SELECT COUNT(*) FROM learning_resources r JOIN curriculum_nodes n ON n.id = r.curriculum_node_id JOIN syllabus_versions v ON v.id = n.syllabus_version_id WHERE v.test_paper_id = p.id) AS lessons_total,
    (SELECT COUNT(*) FROM learning_resources r JOIN curriculum_nodes n ON n.id = r.curriculum_node_id JOIN syllabus_versions v ON v.id = n.syllabus_version_id WHERE v.test_paper_id = p.id AND r.verification IN ('VERIFIED','REJECTED','NEEDS_CHANGES')) AS lessons_decided
  FROM review_assignments a JOIN users u ON u.id = a.user_id JOIN test_papers p ON p.id = a.test_paper_id JOIN exam_cycles c ON c.id = p.exam_cycle_id JOIN exams e ON e.id = c.exam_id`;
type AssignmentRow = Record<string, string | number | null>;
const assignmentOut = (r: AssignmentRow) => ({
  id: r.id, scope: r.scope, note: r.note, createdAt: r.created_at, reviewer: { id: r.user_id, displayName: r.display_name, email: r.email },
  paper: { id: r.paper_id, code: r.paper_code, name: r.paper, exam: r.exam },
  progress: r.scope === 'SYLLABUS' ? { total: Number(r.rows_total), decided: Number(r.rows_decided) } : { total: Number(r.questions_total) + Number(r.lessons_total), decided: Number(r.questions_decided) + Number(r.lessons_decided) },
});

export async function listAssignments(db: D1Database, userId?: string) {
  const stmt = userId ? db.prepare(`${ASSIGNMENT_SQL} WHERE a.user_id = ? ORDER BY a.created_at DESC`).bind(userId) : db.prepare(`${ASSIGNMENT_SQL} ORDER BY a.created_at DESC LIMIT 500`);
  return (await stmt.all<AssignmentRow>()).results.map(assignmentOut);
}

export async function addAssignment(db: D1Database, input: z.infer<typeof assignmentSchema>, staff: Staff) {
  needPermission(staff, 'users:manage', 'assign reviewers');
  const u = await db
    .prepare(`SELECT u.id FROM users u WHERE u.email = ? AND EXISTS (SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id WHERE ur.user_id = u.id AND p.code = 'content:review')`)
    .bind(input.email)
    .first<{ id: string }>();
  if (!u) throw invalid('That account does not exist or does not have a reviewer role yet');
  if (!(await db.prepare('SELECT 1 FROM test_papers WHERE id = ?').bind(input.paperId).first())) throw notFound('Paper');
  const id = newId('asg');
  await db.batch([
    db.prepare('INSERT INTO review_assignments (id, user_id, test_paper_id, scope, note, assigned_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (user_id, test_paper_id, scope) DO UPDATE SET note = excluded.note').bind(id, u.id, input.paperId, input.scope, input.note ?? null, `user:${staff.id}`, nowIso()),
    audit(db, `user:${staff.id}`, 'REVIEW_ASSIGNED', 'USER', u.id, { paperId: input.paperId, scope: input.scope }),
  ]);
  return { assigned: true };
}

export async function removeAssignment(db: D1Database, id: string, staff: Staff) {
  needPermission(staff, 'users:manage', 'remove reviewer assignments');
  const a = await db.prepare('SELECT user_id, test_paper_id, scope FROM review_assignments WHERE id = ?').bind(id).first<{ user_id: string; test_paper_id: string; scope: string }>();
  if (!a) throw notFound('Assignment');
  await db.batch([db.prepare('DELETE FROM review_assignments WHERE id = ?').bind(id), audit(db, `user:${staff.id}`, 'REVIEW_UNASSIGNED', 'USER', a.user_id, { paperId: a.test_paper_id, scope: a.scope })]);
  return { removed: true };
}

// ---------------------------------------------------------------- reviewer dashboard

export async function reviewerDashboard(db: D1Database, userId: string) {
  const [content, nodes, mine, assignments] = await Promise.all([
    db
      .prepare(`SELECT 'QUESTION' AS type, verification, COUNT(*) AS n FROM questions GROUP BY verification UNION ALL SELECT 'LEARNING_RESOURCE', verification, COUNT(*) FROM learning_resources GROUP BY verification`)
      .all<{ type: string; verification: string; n: number }>(),
    db.prepare(`SELECT n.verification, COUNT(*) AS n FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id WHERE v.status != 'ARCHIVED' GROUP BY n.verification`).all<{ verification: string; n: number }>(),
    db
      .prepare(`SELECT id, entity_type, entity_id, action, to_status, comment, created_at FROM review_records WHERE actor = ? ORDER BY created_at DESC, id DESC LIMIT 20`)
      .bind(`user:${userId}`)
      .all<Record<string, string | null>>(),
    listAssignments(db, userId),
  ]);
  const myCount = await db.prepare(`SELECT COUNT(*) AS n FROM review_records WHERE actor = ? AND action IN ('VERIFIED','CHANGES_REQUESTED','REJECTED')`).bind(`user:${userId}`).first<{ n: number }>();
  return { content: content.results, syllabusRows: nodes.results, myDecisions: myCount?.n ?? 0, myRecent: mine.results, assignments };
}
