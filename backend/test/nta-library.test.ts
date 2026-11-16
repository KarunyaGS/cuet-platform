import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../src/index';
import type { Bindings } from '../src/types';

// NTA's own question papers and answer keys hosted in CUET Prep's storage (16 Nov 2026): served from our storage, with provenance,
// flagged files kept out, third-party copies hidden when NTA's verified file is hosted, and each file stored once.
const ADMIN = { 'x-admin-token': 'test-admin-token' };
const b = env as unknown as Bindings;

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }, b, ctx);
  await waitOnExecutionContext(ctx);
  const buf = new Uint8Array(await res.arrayBuffer());
  const text = new TextDecoder().decode(buf);
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* a file */ }
  return { status: res.status, json: json as Record<string, any> | null, bytes: buf, headers: res.headers };
}

const doc = (over: Record<string, unknown>) => ({
  key: 'x', exam: 'CUET_UG', year: 2025, kind: 'QUESTION_PAPER', classification: 'THIRD_PARTY_COPY', official: false, section: 'DOMAIN', subjectCode: '322', subjectName: 'Physics', subjectSlug: 'physics', listedAs: null,
  title: 'CUET UG 2025 Question Paper Physics', examDate: null, shift: null, language: 'English', sourceSite: 'AglaSem', sourcePageUrl: 'https://admission.example.com/cuet', documentPageUrl: 'https://docs.example.com/view/abc',
  fileUrl: 'https://cdn.example.com/abc.pdf', fileHost: 'cdn.example.com', pages: 42, bytes: 1000, working: true, httpStatus: 200, embeddable: false, sourceClaim: null, note: null, alternatives: [], checkedOn: '2026-11-16', ...over,
});
const NTA = { sourceSite: 'NTA', classification: 'OFFICIAL', official: true, documentPageUrl: null, fileHost: 'nta.ac.in' };
const PDF = new TextEncoder().encode('%PDF-1.4\n% NTA test paper\n' + 'x'.repeat(3000));

describe('NTA library: hosted official documents', () => {
  it('serves NTA’s own file from our storage with its provenance, hides flagged files and copies, and keeps each file once', async () => {
    const imp = await call('POST', '/api/admin/pyq-index', {
      schema: 'cuet-pyq-index/1', exam: 'CUET_UG', builtOn: '2026-11-16',
      documents: [
        doc({ key: 'nta:paper:phy-2025', ...NTA, title: 'CUET (UG) 2025 question paper: Physics', fileUrl: 'https://nta.ac.in/Download/ExamPaper/Paper_phy.pdf', language: 'English + Hindi' }),
        doc({ key: 'aglasem:phy-2025', title: 'Physics copy on another website' }),
        doc({ key: 'nta:paper:chem-2025', ...NTA, subjectCode: '306', subjectName: 'Chemistry', subjectSlug: 'chemistry', title: 'CUET (UG) 2025 question paper: Chemistry (identity unverified)', fileUrl: 'https://nta.ac.in/Download/ExamPaper/Paper_chem.pdf', language: 'English + Hindi' }),
        doc({ key: 'aglasem:chem-2025', subjectCode: '306', subjectName: 'Chemistry', subjectSlug: 'chemistry', title: 'Chemistry copy on another website' }),
        doc({ key: 'nta:final-key:2025', kind: 'ANSWER_KEY', ...NTA, section: null, subjectCode: null, subjectName: null, subjectSlug: null, title: 'CUET (UG) 2025: Final Answer Keys', fileUrl: 'https://nta.ac.in/Download/Notice/key.pdf' }),
      ],
    }, ADMIN);
    expect(imp.status).toBeLessThan(300);
    const id = async (key: string) => (await env.DB.prepare('SELECT id FROM pyq_documents WHERE key = ?').bind(key).first<{ id: string }>())!.id;
    const phy = await id('nta:paper:phy-2025');
    const chem = await id('nta:paper:chem-2025');
    const key = await id('nta:final-key:2025');

    // Host Physics (verified) and the key; store Chemistry but flag it (identity unverified).
    const host = async (docId: string, sha: string, r2: string, verification: 'VERIFIED' | 'FLAGGED', url: string) => {
      await env.MEDIA.put(r2, PDF, { httpMetadata: { contentType: 'application/pdf' } });
      await env.DB.prepare(`INSERT INTO pyq_hosted_files (id, document_id, sha256, bytes, pages, r2_key, source_url, retrieved_at, http_status, verification, rights_status, rights_basis, created_at, updated_at) VALUES (?, ?, ?, ?, 42, ?, ?, '2026-11-16T10:00:00Z', 200, ?, 'CONFIRMED_BY_MANAGEMENT', 'test', datetime('now'), datetime('now'))`).bind(`hf_${sha}`, docId, sha, PDF.length, r2, url, verification).run();
      if (verification === 'VERIFIED') await env.DB.prepare('UPDATE pyq_documents SET r2_key = ? WHERE id = ?').bind(r2, docId).run();
      else await env.DB.prepare("UPDATE pyq_documents SET review_state = 'IDENTITY_UNVERIFIED' WHERE id = ?").bind(docId).run();
    };
    await host(phy, 'a'.repeat(64), 'pyq/official/ug/2025/question-paper/322-test.pdf', 'VERIFIED', 'https://nta.ac.in/Download/ExamPaper/Paper_phy.pdf');
    await host(key, 'b'.repeat(64), 'pyq/official/ug/2025/answer-key/final-test.pdf', 'VERIFIED', 'https://nta.ac.in/Download/Notice/key.pdf');
    await host(chem, 'c'.repeat(64), 'pyq/official/ug/2025/question-paper/306-test.pdf', 'FLAGGED', 'https://nta.ac.in/Download/ExamPaper/Paper_chem.pdf');

    // Physics: NTA's file is listed (it is bilingual, so the old English-only rule would have hidden it), opens in the viewer here, can be downloaded, and keeps its source.
    const p = await call('GET', '/api/learn/pyq/2025/physics?exam=CUET_UG');
    expect(p.status).toBe(200);
    const titles = p.json!.papers.map((x: { title: string }) => x.title);
    expect(titles).toEqual(['CUET (UG) 2025 question paper: Physics']); // the third-party copy of the same paper is not listed
    const paper = p.json!.papers[0];
    expect(paper).toMatchObject({ viewer: 'IN_APP', native: true, official: true, originalUrl: 'https://nta.ac.in/Download/ExamPaper/Paper_phy.pdf' });
    expect(paper.fileUrl).toBe(`/api/learn/pyq/documents/${phy}/file`);
    expect(paper.downloadUrl).toBe(`/api/learn/pyq/documents/${phy}/file?download=1`);
    expect(paper.hosted).toMatchObject({ sha256: 'a'.repeat(64), verification: 'VERIFIED', sourceUrl: 'https://nta.ac.in/Download/ExamPaper/Paper_phy.pdf' });
    expect(paper.sourcePageUrl).toBe('https://admission.example.com/cuet'); // its real source page, not "/practice-centre"

    // The file itself: whole, in ranges, and as a download. Students never need NTA's website to read it.
    const file = await call('GET', paper.fileUrl);
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('application/pdf');
    expect(file.bytes.length).toBe(PDF.length);
    expect(new TextDecoder().decode(file.bytes.slice(0, 8))).toBe('%PDF-1.4');
    const part = await call('GET', paper.fileUrl, undefined, { range: 'bytes=0-99' });
    expect(part.status).toBe(206);
    expect(part.bytes.length).toBe(100);
    expect((await call('GET', paper.downloadUrl)).headers.get('content-disposition')).toMatch(/^attachment/);

    // Chemistry: the file is stored but flagged, so it is not listed and not served; the third-party copy stays because no verified NTA file is hosted.
    const c = await call('GET', '/api/learn/pyq/2025/chemistry?exam=CUET_UG');
    expect(c.json!.papers.map((x: { title: string }) => x.title)).toEqual(['Chemistry copy on another website']);
    expect((await call('GET', `/api/learn/pyq/documents/${chem}/file`)).status).toBe(404);
    expect((await call('GET', `/api/learn/pyq/documents/${chem}`)).status).toBe(404);

    // The answer key is hosted too and can be opened and downloaded.
    const k = await call('GET', `/api/learn/pyq/documents/${key}`);
    expect(k.json).toMatchObject({ viewer: 'IN_APP', native: true, official: true });
    expect((await call('GET', `/api/learn/pyq/documents/${key}/file`)).status).toBe(200);

    // Each file is stored once: the same SHA-256 cannot be recorded twice, nor can one document have two files.
    await expect(env.DB.prepare(`INSERT INTO pyq_hosted_files (id, document_id, sha256, bytes, r2_key, source_url, retrieved_at, verification, rights_status, rights_basis, updated_at) VALUES ('dup1', ?, ?, 1, 'k', 'u', 'now', 'VERIFIED', 'CONFIRMED_BY_MANAGEMENT', 'x', 'now')`).bind(key, 'a'.repeat(64)).run()).rejects.toThrow();
    await expect(env.DB.prepare(`INSERT INTO pyq_hosted_files (id, document_id, sha256, bytes, r2_key, source_url, retrieved_at, verification, rights_status, rights_basis, updated_at) VALUES ('dup2', ?, ?, 1, 'k', 'u', 'now', 'VERIFIED', 'CONFIRMED_BY_MANAGEMENT', 'x', 'now')`).bind(phy, 'd'.repeat(64)).run()).rejects.toThrow();
  });

  it('hosts a permitted third-party copy of another session beside the NTA file, labelled with its source, and hides a copy of the same session', async () => {
    const SS = { sourceSite: 'SelfStudys', fileHost: 'www.selfstudys.com' };
    await env.DB.prepare('DELETE FROM pyq_hosted_files').run(); // the first test's rows; a re-import replaces the index
    const imp = await call('POST', '/api/admin/pyq-index', {
      schema: 'cuet-pyq-index/1', exam: 'CUET_UG', builtOn: '2026-11-16',
      documents: [
        doc({ key: 'nta:paper:math-2024', ...NTA, year: 2024, subjectCode: '319', subjectName: 'Mathematics', subjectSlug: 'mathematics', title: 'CUET (UG) 2024: Mathematics', examDate: '2024-05-16', shift: 'Shift 2', fileUrl: 'https://nta.ac.in/Download/ExamPaper/m.pdf' }),
        doc({ key: 'selfstudys:1', ...SS, year: 2024, subjectCode: '319', subjectName: 'Mathematics', subjectSlug: 'mathematics', title: 'CUET UG (Mathematics) 16 May 2024 Shift 2', examDate: '2024-05-16', shift: 'Shift 2', fileUrl: 'https://www.selfstudys.com/sitepdfs/a' }),
        doc({ key: 'selfstudys:2', ...SS, year: 2024, subjectCode: '319', subjectName: 'Mathematics', subjectSlug: 'mathematics', title: 'CUET UG (Mathematics) 17 May 2024 Shift 1', examDate: '2024-05-17', shift: 'Shift 1', fileUrl: 'https://www.selfstudys.com/sitepdfs/b' }),
      ],
    }, ADMIN);
    expect(imp.status).toBeLessThan(300);
    const id = async (key: string) => (await env.DB.prepare('SELECT id FROM pyq_documents WHERE key = ?').bind(key).first<{ id: string }>())!.id;
    const nta = await id('nta:paper:math-2024'); const ss2 = await id('selfstudys:2');
    await env.MEDIA.put('pyq/m-nta.pdf', PDF); await env.MEDIA.put('pyq/m-ss.pdf', PDF);
    await env.DB.prepare('UPDATE pyq_documents SET r2_key = ? WHERE id = ?').bind('pyq/m-nta.pdf', nta).run();
    await env.DB.prepare('UPDATE pyq_documents SET r2_key = ? WHERE id = ?').bind('pyq/m-ss.pdf', ss2).run();
    await env.DB.prepare(`INSERT INTO pyq_hosted_files (id, document_id, sha256, bytes, pages, r2_key, source_url, retrieved_at, http_status, verification, rights_status, rights_basis, created_at, updated_at) VALUES ('hf-ss2', ?, ?, 3000, 9, 'pyq/m-ss.pdf', 'https://www.selfstudys.com/sitepdfs/b', '2026-11-16T00:00:00Z', 200, 'VERIFIED', 'CONFIRMED_BY_MANAGEMENT', 'permission', '2026-11-16', '2026-11-16')`).bind(ss2, 'd'.repeat(64)).run();
    const r = await call('GET', '/api/learn/pyq/2024/mathematics?exam=CUET_UG');
    const titles = (r.json!.papers as { title: string }[]).map((x) => x.title);
    expect(titles).toContain('CUET (UG) 2024: Mathematics');
    expect(titles).toContain('CUET UG (Mathematics) 17 May 2024 Shift 1'); // another session: a different paper, not a duplicate
    expect(titles).not.toContain('CUET UG (Mathematics) 16 May 2024 Shift 2'); // same session as NTA's file: NTA's version wins
    const copy = (r.json!.papers as any[]).find((x) => x.title.includes('17 May'));
    expect(copy.hosted.verification).toBe('VERIFIED');
    expect(copy.classification).toBe('THIRD_PARTY_COPY');
    expect(copy.sourceSite).toBe('SelfStudys');
    expect(copy.originalUrl).toBe('https://www.selfstudys.com/sitepdfs/b');
    expect((await call('GET', copy.fileUrl)).status).toBe(200);
  });
});
