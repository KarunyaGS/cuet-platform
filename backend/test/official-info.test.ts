import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../src/index';

const ADMIN = { 'x-admin-token': 'test-admin-token', 'content-type': 'application/json' };

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

const PDF = 'https://cdnbbsr.s3waas.gov.in/test/bulletin.pdf';
const info = (cycle = '2026', fee = 'General: Rs 1000 for up to three subjects.') => ({
  exam: 'CUET_UG',
  cycle,
  asOf: '2026-11-12',
  sections: [
    { key: 'about', title: 'About CUET (UG)', items: [{ text: 'One test for undergraduate admission at participating universities.', source: PDF, page: 14 }] },
    { key: 'fees', title: 'Application fee', items: [{ text: fee, source: PDF, page: 20, note: 'Bank charges are extra.' }] },
  ],
  notices: [
    { date: '2026-03-01', title: 'Public notice: exam city slip', url: 'https://nta.ac.in/Download/Notice/a.pdf' },
    { date: '2026-05-01', title: 'Public notice: answer key', url: 'https://nta.ac.in/Download/Notice/b.pdf' },
  ],
  unknown: ['No 2027 bulletin has been published yet.'],
  universities: [
    { name: 'UNIVERSITY OF DELHI', type: 'Central University', state: null, sourceUrl: 'https://cuet.nta.nic.in/participating-universities/' },
    { name: 'JAMIA MILLIA ISLAMIA', type: 'Central University', state: null, sourceUrl: 'https://cuet.nta.nic.in/participating-universities/' },
    { name: 'DELHI TECHNOLOGICAL UNIVERSITY', type: 'State University', state: null, sourceUrl: 'https://cuet.nta.nic.in/participating-universities/' },
  ],
});

describe('official exam information', () => {
  it('only an admin can import, and the exam in the address must match', async () => {
    expect((await call('PUT', '/api/admin/official-info/CUET_UG', info())).status).toBe(401);
    expect((await call('PUT', '/api/admin/official-info/CUET_PG', info(), ADMIN)).status).toBe(422);
    expect((await call('PUT', '/api/admin/official-info/CUET_UG', { ...info(), sections: [] }, ADMIN)).status).toBe(400);
  });

  it('imports facts with their sources and serves them publicly, newest notices first', async () => {
    expect((await call('GET', '/api/public/info/CUET_UG')).status).toBe(404);
    const imp = await call('PUT', '/api/admin/official-info/CUET_UG', info(), ADMIN);
    expect(imp.json).toEqual({ exam: 'CUET_UG', cycle: '2026', items: 3, notices: 2, universities: 3 });
    const pub = (await call('GET', '/api/public/info/CUET_UG')).json;
    expect(pub).toMatchObject({ exam: 'CUET_UG', cycle: '2026', asOf: '2026-11-12', universities: { total: 3 } });
    expect(pub.sections.map((s: { key: string }) => s.key)).toEqual(['about', 'fees', 'not-yet-published']);
    expect(pub.sections[1].items[0]).toEqual({ text: 'General: Rs 1000 for up to three subjects.', source: PDF, page: 20, note: 'Bank charges are extra.' });
    expect(pub.notices.map((n: { date: string }) => n.date)).toEqual(['2026-05-01', '2026-03-01']);
    expect((await call('GET', '/api/public/info/CUET_PG')).status).toBe(404); // UG and PG stay separate
    expect((await call('GET', '/api/public/info/NEET')).status).toBe(400);
  });

  it('a re-import replaces the cycle instead of mixing old and new facts', async () => {
    await call('PUT', '/api/admin/official-info/CUET_UG', info(), ADMIN);
    await call('PUT', '/api/admin/official-info/CUET_UG', info('2026', 'General: Rs 1100 for up to three subjects.'), ADMIN);
    const pub = (await call('GET', '/api/public/info/CUET_UG')).json;
    expect(pub.sections[1].items).toHaveLength(1);
    expect(pub.sections[1].items[0].text).toContain('1100');
    // a newer cycle becomes the one shown
    await call('PUT', '/api/admin/official-info/CUET_UG', info('2027'), ADMIN);
    expect((await call('GET', '/api/public/info/CUET_UG')).json.cycle).toBe('2027');
  });

  it('lists participating universities with search and type filter', async () => {
    await call('PUT', '/api/admin/official-info/CUET_UG', info(), ADMIN);
    const all = (await call('GET', '/api/public/universities?exam=CUET_UG')).json;
    expect(all).toMatchObject({ total: 3, types: [{ type: 'Central University', count: 2 }, { type: 'State University', count: 1 }] });
    expect((await call('GET', '/api/public/universities?exam=CUET_UG&q=delhi')).json.universities.map((u: { name: string }) => u.name)).toEqual(['DELHI TECHNOLOGICAL UNIVERSITY', 'UNIVERSITY OF DELHI']);
    expect((await call('GET', '/api/public/universities?exam=CUET_UG&type=State%20University')).json.universities).toHaveLength(1);
    expect((await call('GET', '/api/public/universities?exam=CUET_PG')).json).toMatchObject({ total: 0, universities: [] });
  });
});
