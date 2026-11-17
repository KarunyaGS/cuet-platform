/**
 * Help and support: a chat conversation and tickets, each a thread of messages between one student and the support team.
 *
 * Access rules (enforced here, not in the browser):
 *  - A student reaches a thread only through `user_id = their own id`. Another student's thread id answers "not found".
 *  - Attachments are stored under `support/<user id>/...` and are served only to that student or to staff.
 *  - Staff see threads through the console API, which checks the staff permission.
 * Nothing here pretends: there is no automatic reply and no availability claim. A message is answered by a person.
 */
import { z } from 'zod';
import { ApiError, invalid, notFound } from '../lib/errors';
import { newId } from '../lib/hash';
import { nowIso } from '../lib/sql';

export const CATEGORIES = [
  { code: 'ACCOUNT', label: 'Account and login' },
  { code: 'PAYMENT', label: 'Payment and subscription' },
  { code: 'MATERIAL', label: 'Study material or PDF' },
  { code: 'QUESTIONS', label: 'Question bank or mock test' },
  { code: 'TECHNICAL', label: 'Technical issue' },
  { code: 'OTHER', label: 'Other' },
] as const;
const CATEGORY_CODES = CATEGORIES.map((c) => c.code) as [string, ...string[]];
export const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED'] as const;

export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const TYPES: Record<string, { ext: string; magic: (b: Uint8Array) => boolean }> = {
  'image/png': { ext: 'png', magic: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  'image/jpeg': { ext: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/webp': { ext: 'webp', magic: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  'application/pdf': { ext: 'pdf', magic: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d },
};

const attachmentRef = z.object({ key: z.string().min(10).max(200), name: z.string().min(1).max(120), mime: z.string().max(60), bytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES) });
const body = z.string().trim().min(1, 'Write a message').max(4000);
export const chatMessageSchema = z.object({ body, attachment: attachmentRef.optional() });
export const ticketSchema = z.object({
  category: z.enum(CATEGORY_CODES),
  title: z.string().trim().min(5, 'Give the issue a short title').max(120),
  description: z.string().trim().min(10, 'Describe the issue in a few words').max(4000),
  attachment: attachmentRef.optional(),
});
export const replySchema = chatMessageSchema;
export const staffStatusSchema = z.object({ status: z.enum(STATUSES) });
export const staffThreadsQuery = z.object({ status: z.enum(STATUSES).optional(), kind: z.enum(['CHAT', 'TICKET']).optional(), q: z.string().trim().max(80).optional() });

type Attachment = z.infer<typeof attachmentRef>;
interface MessageRow { id: string; thread_id: string; sender: string; body: string; attachment_key: string | null; attachment_name: string | null; attachment_mime: string | null; attachment_bytes: number | null; created_at: string }
interface ThreadRow { id: string; user_id: string; kind: string; ticket_no: number | null; reference: string | null; category: string | null; title: string | null; status: string; created_at: string; updated_at: string; last_message_at: string; last_staff_reply_at: string | null; student_seen_at: string | null }

const categoryLabel = (code: string | null) => CATEGORIES.find((c) => c.code === code)?.label ?? code;
const publicMessage = (m: MessageRow) => ({
  id: m.id, from: m.sender === 'STAFF' ? ('SUPPORT' as const) : ('YOU' as const), body: m.body, at: m.created_at,
  attachment: m.attachment_key ? { name: m.attachment_name, mime: m.attachment_mime, bytes: m.attachment_bytes } : null,
});
const publicThread = (t: ThreadRow) => ({
  id: t.id, kind: t.kind, reference: t.reference, category: t.category, categoryLabel: categoryLabel(t.category), title: t.title, status: t.status,
  createdAt: t.created_at, updatedAt: t.updated_at, lastMessageAt: t.last_message_at, hasUnreadReply: Boolean(t.last_staff_reply_at && (!t.student_seen_at || t.student_seen_at < t.last_staff_reply_at)),
});

async function messagesOf(db: D1Database, threadId: string) {
  const { results } = await db.prepare('SELECT * FROM support_messages WHERE thread_id = ? ORDER BY created_at, id').bind(threadId).all<MessageRow>();
  return results;
}

/** A student's own thread, or "not found". The user id is part of the query, so another student's id never matches. */
async function ownThread(db: D1Database, userId: string, id: string, kind?: 'CHAT' | 'TICKET'): Promise<ThreadRow> {
  const t = await db.prepare(`SELECT * FROM support_threads WHERE id = ? AND user_id = ?${kind ? ' AND kind = ?' : ''}`).bind(...(kind ? [id, userId, kind] : [id, userId])).first<ThreadRow>();
  if (!t) throw notFound('Support request');
  return t;
}

// ---------------------------------------------------------------- attachments

/** Stores one attachment for a student after checking its type, its size and that its first bytes really are that type. */
export async function storeAttachment(bucket: R2Bucket, userId: string, data: ArrayBuffer, mime: string, filename: string): Promise<Attachment> {
  const kind = TYPES[mime];
  if (!kind) throw invalid('Attach a PNG, JPG, WebP or PDF file');
  if (data.byteLength === 0) throw invalid('The file is empty');
  if (data.byteLength > MAX_ATTACHMENT_BYTES) throw new ApiError(413, 'TOO_LARGE', `The file is larger than ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB`);
  if (!kind.magic(new Uint8Array(data.slice(0, 16)))) throw invalid('The file does not match its type');
  const name = (filename || `attachment.${kind.ext}`).replace(/[^\w.\- ]+/g, '_').slice(0, 100) || `attachment.${kind.ext}`;
  const key = `support/${userId}/${crypto.randomUUID().replace(/-/g, '')}.${kind.ext}`;
  await bucket.put(key, data, { httpMetadata: { contentType: mime } });
  return { key, name, mime, bytes: data.byteLength };
}

/** An attachment named in a message must be one this student uploaded (their own folder) and must exist. */
async function checkAttachment(bucket: R2Bucket, userId: string, a: Attachment | undefined) {
  if (!a) return;
  if (!a.key.startsWith(`support/${userId}/`) || a.key.includes('..')) throw invalid('That attachment is not yours');
  if (!(await bucket.head(a.key))) throw invalid('The attachment was not found. Attach it again.');
}

async function addMessage(db: D1Database, thread: ThreadRow, sender: 'STUDENT' | 'STAFF', senderUserId: string, text: string, a: Attachment | undefined, now: string) {
  const id = newId('sm');
  await db.batch([
    db.prepare('INSERT INTO support_messages (id, thread_id, sender, sender_user_id, body, attachment_key, attachment_name, attachment_mime, attachment_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, thread.id, sender, senderUserId, text, a?.key ?? null, a?.name ?? null, a?.mime ?? null, a?.bytes ?? null, now),
    sender === 'STUDENT'
      // A student's reply to a resolved ticket reopens it.
      ? db.prepare("UPDATE support_threads SET last_message_at = ?, updated_at = ?, status = CASE WHEN status = 'RESOLVED' THEN 'OPEN' ELSE status END WHERE id = ?").bind(now, now, thread.id)
      : db.prepare("UPDATE support_threads SET last_message_at = ?, updated_at = ?, last_staff_reply_at = ?, status = CASE WHEN status = 'OPEN' THEN 'IN_PROGRESS' ELSE status END WHERE id = ?").bind(now, now, now, thread.id),
  ]);
  return id;
}

// ---------------------------------------------------------------- student: chat

export async function getChat(db: D1Database, userId: string) {
  const t = await db.prepare("SELECT * FROM support_threads WHERE user_id = ? AND kind = 'CHAT'").bind(userId).first<ThreadRow>();
  if (!t) return { thread: null, messages: [] };
  await db.prepare('UPDATE support_threads SET student_seen_at = ? WHERE id = ?').bind(nowIso(), t.id).run();
  return { thread: publicThread(t), messages: (await messagesOf(db, t.id)).map(publicMessage) };
}

export async function sendChat(db: D1Database, bucket: R2Bucket, userId: string, input: z.infer<typeof chatMessageSchema>) {
  await checkAttachment(bucket, userId, input.attachment);
  const now = nowIso();
  let t = await db.prepare("SELECT * FROM support_threads WHERE user_id = ? AND kind = 'CHAT'").bind(userId).first<ThreadRow>();
  if (!t) {
    const id = newId('st');
    await db.prepare("INSERT OR IGNORE INTO support_threads (id, user_id, kind, status, created_at, updated_at, last_message_at) VALUES (?, ?, 'CHAT', 'OPEN', ?, ?, ?)").bind(id, userId, now, now, now).run();
    t = (await db.prepare("SELECT * FROM support_threads WHERE user_id = ? AND kind = 'CHAT'").bind(userId).first<ThreadRow>())!;
  }
  await addMessage(db, t, 'STUDENT', userId, input.body, input.attachment, now);
  return getChat(db, userId);
}

// ---------------------------------------------------------------- student: tickets

export async function listTickets(db: D1Database, userId: string) {
  const { results } = await db.prepare("SELECT * FROM support_threads WHERE user_id = ? AND kind = 'TICKET' ORDER BY last_message_at DESC LIMIT 200").bind(userId).all<ThreadRow>();
  return results.map(publicThread);
}

export async function createTicket(db: D1Database, bucket: R2Bucket, userId: string, input: z.infer<typeof ticketSchema>) {
  await checkAttachment(bucket, userId, input.attachment);
  const now = nowIso();
  const id = newId('st');
  // The reference comes from a running ticket number; the unique index makes two tickets at once retry with the next number.
  for (let attempt = 0; attempt < 4; attempt++) {
    const next = ((await db.prepare('SELECT COALESCE(MAX(ticket_no), 1000) AS n FROM support_threads').first<{ n: number }>())?.n ?? 1000) + 1;
    try {
      await db.prepare("INSERT INTO support_threads (id, user_id, kind, ticket_no, reference, category, title, status, created_at, updated_at, last_message_at) VALUES (?, ?, 'TICKET', ?, ?, ?, ?, 'OPEN', ?, ?, ?)")
        .bind(id, userId, next, `PRP-${next}`, input.category, input.title, now, now, now).run();
      break;
    } catch (e) {
      if (attempt === 3 || !/UNIQUE|constraint/i.test(String((e as Error).message))) throw e;
    }
  }
  const t = (await db.prepare('SELECT * FROM support_threads WHERE id = ?').bind(id).first<ThreadRow>())!;
  await addMessage(db, t, 'STUDENT', userId, input.description, input.attachment, now);
  return ticketDetail(db, userId, id);
}

export async function ticketDetail(db: D1Database, userId: string, id: string) {
  const t = await ownThread(db, userId, id, 'TICKET');
  await db.prepare('UPDATE support_threads SET student_seen_at = ? WHERE id = ?').bind(nowIso(), t.id).run();
  return { thread: publicThread(t), messages: (await messagesOf(db, t.id)).map(publicMessage) };
}

export async function replyTicket(db: D1Database, bucket: R2Bucket, userId: string, id: string, input: z.infer<typeof replySchema>) {
  const t = await ownThread(db, userId, id, 'TICKET');
  await checkAttachment(bucket, userId, input.attachment);
  await addMessage(db, t, 'STUDENT', userId, input.body, input.attachment, nowIso());
  return ticketDetail(db, userId, id);
}

/** A student's number of replies they have not seen yet (for the badge on the support button). */
export async function unreadCount(db: D1Database, userId: string) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM support_threads WHERE user_id = ? AND last_staff_reply_at IS NOT NULL AND (student_seen_at IS NULL OR student_seen_at < last_staff_reply_at)').bind(userId).first<{ n: number }>();
  return { unread: r?.n ?? 0 };
}

async function sendObject(bucket: R2Bucket, m: MessageRow): Promise<Response> {
  if (!m.attachment_key) throw notFound('Attachment');
  const obj = await bucket.get(m.attachment_key);
  if (!obj) throw notFound('Attachment');
  const inline = /^image\//.test(m.attachment_mime ?? '');
  return new Response(obj.body, {
    headers: {
      'content-type': m.attachment_mime ?? 'application/octet-stream',
      'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${(m.attachment_name ?? 'attachment').replace(/"/g, '')}"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
    },
  });
}

/** A student's attachment: only from a thread that is theirs. */
export async function studentAttachment(db: D1Database, bucket: R2Bucket, userId: string, messageId: string): Promise<Response> {
  const m = await db.prepare('SELECT m.* FROM support_messages m JOIN support_threads t ON t.id = m.thread_id WHERE m.id = ? AND t.user_id = ?').bind(messageId, userId).first<MessageRow>();
  if (!m) throw notFound('Attachment');
  return sendObject(bucket, m);
}

// ---------------------------------------------------------------- staff (console)

export async function staffThreads(db: D1Database, q: z.infer<typeof staffThreadsQuery>) {
  const where: string[] = [];
  const args: string[] = [];
  if (q.status) (where.push('t.status = ?'), args.push(q.status));
  if (q.kind) (where.push('t.kind = ?'), args.push(q.kind));
  if (q.q) {
    where.push('(t.reference LIKE ? OR t.title LIKE ? OR u.email LIKE ? OR u.display_name LIKE ?)');
    const like = `%${q.q.replace(/[%_]/g, '')}%`;
    args.push(like, like, like, like);
  }
  const { results } = await db
    .prepare(`SELECT t.*, u.email AS user_email, u.display_name AS user_name, (SELECT COUNT(*) FROM support_messages m WHERE m.thread_id = t.id) AS messages,
        (SELECT sender FROM support_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_sender
      FROM support_threads t JOIN users u ON u.id = t.user_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY t.last_message_at DESC LIMIT 200`)
    .bind(...args)
    .all<ThreadRow & { user_email: string; user_name: string; messages: number; last_sender: string | null }>();
  return results.map((t) => ({ ...publicThread(t), student: { email: t.user_email, name: t.user_name }, messages: t.messages, waitingForSupport: t.last_sender === 'STUDENT' && t.status !== 'RESOLVED' }));
}

export async function staffThread(db: D1Database, id: string) {
  const t = await db.prepare('SELECT t.*, u.email AS user_email, u.display_name AS user_name FROM support_threads t JOIN users u ON u.id = t.user_id WHERE t.id = ?').bind(id).first<ThreadRow & { user_email: string; user_name: string }>();
  if (!t) throw notFound('Support request');
  return { thread: { ...publicThread(t), student: { email: t.user_email, name: t.user_name } }, messages: (await messagesOf(db, id)).map((m) => ({ ...publicMessage(m), from: m.sender === 'STAFF' ? 'SUPPORT' : 'STUDENT' })) };
}

export async function staffReply(db: D1Database, staffId: string, id: string, input: { body: string }) {
  const t = await db.prepare('SELECT * FROM support_threads WHERE id = ?').bind(id).first<ThreadRow>();
  if (!t) throw notFound('Support request');
  await addMessage(db, t, 'STAFF', staffId, input.body, undefined, nowIso());
  return staffThread(db, id);
}

export async function staffSetStatus(db: D1Database, id: string, status: (typeof STATUSES)[number]) {
  const r = await db.prepare('UPDATE support_threads SET status = ?, updated_at = ? WHERE id = ?').bind(status, nowIso(), id).run();
  if (!r.meta.changes) throw notFound('Support request');
  return staffThread(db, id);
}

export async function staffAttachment(db: D1Database, bucket: R2Bucket, messageId: string): Promise<Response> {
  const m = await db.prepare('SELECT * FROM support_messages WHERE id = ?').bind(messageId).first<MessageRow>();
  if (!m) throw notFound('Attachment');
  return sendObject(bucket, m);
}
