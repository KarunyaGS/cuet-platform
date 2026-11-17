import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../src/index';
import type { Bindings } from '../src/types';

const ADMIN = { 'x-admin-token': 'test-admin-token' };
const mock = env as unknown as Bindings;

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const ctx = createExecutionContext();
  const isBinary = body instanceof Uint8Array;
  const res = await app.request(path, { method, headers: { ...(isBinary ? {} : { 'content-type': 'application/json' }), ...headers }, body: body === undefined ? undefined : isBinary ? (body as BodyInit) : JSON.stringify(body) }, mock, ctx);
  await waitOnExecutionContext(ctx);
  const type = res.headers.get('content-type') ?? '';
  const raw = new Uint8Array(await res.arrayBuffer());
  const text = new TextDecoder().decode(raw);
  return { status: res.status, json: type.includes('json') && text ? JSON.parse(text) : null, bytes: raw, headers: res.headers, cookie: res.headers.get('set-cookie')?.split(';')[0] ?? '' };
}
let n = 0;
async function person(role?: string) {
  const email = `sup-${++n}-${Date.now()}@example.test`;
  const password = 'correct-horse-battery';
  const r = await call('POST', '/api/auth/register', { email, password, displayName: `Student ${n}` });
  if (role) await call('POST', '/api/admin/users/roles', { email, role }, ADMIN);
  const s = await call('POST', '/api/auth/login', { email, password });
  return { id: r.json.id as string, email, auth: { cookie: s.cookie } };
}
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 1, 2, 3, 4]);
const ticket = { category: 'TECHNICAL', title: 'The PDF will not open', description: 'When I tap the chapter PDF the page stays blank on my phone.' };

describe('support: chat', () => {
  it('needs a signed-in student', async () => {
    expect((await call('GET', '/api/student/support/chat')).status).toBe(401);
    expect((await call('POST', '/api/student/support/chat/messages', { body: 'hi' })).status).toBe(401);
  });

  it('keeps one conversation per student, with history and timestamps', async () => {
    const s = await person();
    expect((await call('GET', '/api/student/support/chat', undefined, s.auth)).json).toEqual({ thread: null, messages: [] });
    const first = await call('POST', '/api/student/support/chat/messages', { body: 'Hello, I need help with my plan' }, s.auth);
    expect(first.status).toBe(201);
    await call('POST', '/api/student/support/chat/messages', { body: 'It says expired but I paid' }, s.auth);
    const chat = (await call('GET', '/api/student/support/chat', undefined, s.auth)).json;
    expect(chat.messages.map((m: { body: string }) => m.body)).toEqual(['Hello, I need help with my plan', 'It says expired but I paid']);
    expect(chat.messages[0]).toMatchObject({ from: 'YOU' });
    expect(Number.isNaN(Date.parse(chat.messages[0].at))).toBe(false);
    expect(env.DB.prepare("SELECT COUNT(*) AS n FROM support_threads WHERE user_id = ? AND kind = 'CHAT'").bind(s.id).first<{ n: number }>()).resolves.toMatchObject({ n: 1 });
  });

  it('rejects an empty or oversized message', async () => {
    const s = await person();
    expect((await call('POST', '/api/student/support/chat/messages', { body: '   ' }, s.auth)).status).toBe(400);
    expect((await call('POST', '/api/student/support/chat/messages', { body: 'x'.repeat(4001) }, s.auth)).status).toBe(400);
  });

  it('shows a staff reply to the student, as "Support", without revealing who wrote it', async () => {
    const s = await person();
    const staff = await person('SUPER_ADMIN');
    await call('POST', '/api/student/support/chat/messages', { body: 'Can you help?' }, s.auth);
    const threads = (await call('GET', '/api/console/support/threads?kind=CHAT', undefined, staff.auth)).json;
    const mine = threads.find((t: { student: { email: string } }) => t.student.email === s.email);
    expect(mine).toMatchObject({ waitingForSupport: true, student: { name: expect.any(String) } });
    const reply = await call('POST', `/api/console/support/threads/${mine.id}/messages`, { body: 'Yes, tell us more.' }, staff.auth);
    expect(reply.status).toBe(201);
    const chat = (await call('GET', '/api/student/support/chat', undefined, s.auth)).json;
    expect(chat.messages[1]).toMatchObject({ from: 'SUPPORT', body: 'Yes, tell us more.' });
    expect(JSON.stringify(chat)).not.toContain(staff.email);
    expect(JSON.stringify(chat)).not.toContain(staff.id);
  });
});

describe('support: tickets', () => {
  it('raises a ticket with a unique reference, status Open, and shows it in the list', async () => {
    const s = await person();
    const a = await call('POST', '/api/student/support/tickets', ticket, s.auth);
    const b = await call('POST', '/api/student/support/tickets', { ...ticket, category: 'PAYMENT', title: 'Charged twice for one plan' }, s.auth);
    expect(a.status).toBe(201);
    expect(a.json.thread).toMatchObject({ status: 'OPEN', category: 'TECHNICAL', categoryLabel: 'Technical issue', title: 'The PDF will not open' });
    expect(a.json.thread.reference).toMatch(/^PRP-\d+$/);
    expect(b.json.thread.reference).not.toBe(a.json.thread.reference);
    expect(a.json.messages).toHaveLength(1);
    const list = (await call('GET', '/api/student/support/tickets', undefined, s.auth)).json;
    expect(list.map((t: { reference: string }) => t.reference).sort()).toEqual([a.json.thread.reference, b.json.thread.reference].sort());
  });

  it('validates the category, title and description', async () => {
    const s = await person();
    for (const bad of [{ ...ticket, category: 'NOPE' }, { ...ticket, title: 'x' }, { ...ticket, description: 'short' }, { category: 'OTHER' }]) {
      expect((await call('POST', '/api/student/support/tickets', bad, s.auth)).status).toBe(400);
    }
  });

  it('follows a ticket through staff replies, status changes and a reopening reply from the student', async () => {
    const s = await person();
    const staff = await person('SUPER_ADMIN');
    const t = (await call('POST', '/api/student/support/tickets', ticket, s.auth)).json.thread;
    expect((await call('GET', '/api/student/support/unread', undefined, s.auth)).json.unread).toBe(0);
    await call('POST', `/api/console/support/threads/${t.id}/messages`, { body: 'Please try the latest version.' }, staff.auth);
    expect((await call('GET', '/api/student/support/unread', undefined, s.auth)).json.unread).toBe(1);
    expect((await call('GET', '/api/student/support/tickets', undefined, s.auth)).json[0]).toMatchObject({ status: 'IN_PROGRESS', hasUnreadReply: true });
    const seen = (await call('GET', `/api/student/support/tickets/${t.id}`, undefined, s.auth)).json;
    expect(seen.messages.map((m: { from: string }) => m.from)).toEqual(['YOU', 'SUPPORT']);
    expect((await call('GET', '/api/student/support/unread', undefined, s.auth)).json.unread).toBe(0);
    expect((await call('PUT', `/api/console/support/threads/${t.id}/status`, { status: 'RESOLVED' }, staff.auth)).json.thread.status).toBe('RESOLVED');
    expect((await call('PUT', `/api/console/support/threads/${t.id}/status`, { status: 'WRONG' }, staff.auth)).status).toBe(400);
    const again = await call('POST', `/api/student/support/tickets/${t.id}/messages`, { body: 'It still happens on my tablet.' }, s.auth);
    expect(again.json.thread.status).toBe('OPEN');
    expect(again.json.messages).toHaveLength(3);
  });
});

describe('support: student isolation', () => {
  it('never lets one student read, reply to or download another student\'s support request', async () => {
    const a = await person();
    const b = await person();
    const upload = await call('POST', '/api/student/support/attachments', PNG, { ...a.auth, 'content-type': 'image/png', 'x-filename': 'shot.png' });
    expect(upload.status).toBe(201);
    const t = (await call('POST', '/api/student/support/tickets', { ...ticket, attachment: upload.json }, a.auth)).json;
    const messageId = t.messages[0].id as string;
    // B cannot see it anywhere
    expect((await call('GET', `/api/student/support/tickets/${t.thread.id}`, undefined, b.auth)).status).toBe(404);
    expect((await call('POST', `/api/student/support/tickets/${t.thread.id}/messages`, { body: 'I am not the owner' }, b.auth)).status).toBe(404);
    expect((await call('GET', `/api/student/support/attachments/${messageId}`, undefined, b.auth)).status).toBe(404);
    expect((await call('GET', '/api/student/support/tickets', undefined, b.auth)).json).toEqual([]);
    expect((await call('GET', '/api/student/support/chat', undefined, b.auth)).json.thread).toBeNull();
    // A can
    const file = await call('GET', `/api/student/support/attachments/${messageId}`, undefined, a.auth);
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('image/png');
    expect(file.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Array.from(file.bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    // B cannot attach A's file to B's own ticket
    expect((await call('POST', '/api/student/support/tickets', { ...ticket, attachment: upload.json }, b.auth)).status).toBe(422);
  });

  it('keeps the staff area closed to students', async () => {
    const s = await person();
    expect((await call('GET', '/api/console/support/threads', undefined, s.auth)).status).toBe(403);
    expect((await call('GET', '/api/console/support/threads')).status).toBe(401);
  });
});

describe('support: attachments', () => {
  const up = (data: Uint8Array, type: string, auth: Record<string, string>, name = 'file') => call('POST', '/api/student/support/attachments', data, { ...auth, 'content-type': type, 'x-filename': name });
  it('accepts PNG, JPG, WebP and PDF that really are those types', async () => {
    const s = await person();
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    const pdf = new TextEncoder().encode('%PDF-1.7\n%test');
    for (const [d, t] of [[PNG, 'image/png'], [jpg, 'image/jpeg'], [webp, 'image/webp'], [pdf, 'application/pdf']] as const) expect((await up(d, t, s.auth)).status).toBe(201);
  });
  it('refuses other types, wrong content, empty and oversized files', async () => {
    const s = await person();
    expect((await up(new TextEncoder().encode('<script>alert(1)</script>'), 'text/html', s.auth)).status).toBe(422);
    expect((await up(new TextEncoder().encode('MZ......'), 'image/png', s.auth)).status).toBe(422);
    expect((await up(new TextEncoder().encode('not a pdf at all'), 'application/pdf', s.auth)).status).toBe(422);
    expect((await up(new Uint8Array(0), 'image/png', s.auth)).status).toBe(422);
    const big = new Uint8Array(3 * 1024 * 1024 + 1);
    big.set(PNG);
    expect((await up(big, 'image/png', s.auth)).status).toBe(413);
    expect((await call('POST', '/api/student/support/attachments', PNG, { 'content-type': 'image/png' })).status).toBe(401);
  });
  it('stores the file under the student\'s own folder and sanitises its name', async () => {
    const s = await person();
    const r = await up(PNG, 'image/png', s.auth, '../../evil name?.png');
    expect(r.json.key.startsWith(`support/${s.id}/`)).toBe(true);
    expect(r.json.name).not.toMatch(/[\/?]/);
  });
});
