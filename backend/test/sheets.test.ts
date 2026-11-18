import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { chapterSheet, subjectSheet, weakSheet } from '../src/services/sheets';

describe('quick revision sheets', () => {
  it('gives a student with no practice an empty weak-topic sheet and invents nothing', async () => {
    const s = await weakSheet(env.DB, true, 'nobody');
    expect(s.sections).toEqual([]);
    expect(s.empty).toMatch(/No weak topics/);
  });
  it('refuses an unknown chapter or subject', async () => {
    await expect(chapterSheet(env.DB, true, 'cn_missing')).rejects.toMatchObject({ status: 404 });
    await expect(subjectSheet(env.DB, true, 'paper_missing')).rejects.toMatchObject({ status: 404 });
  });
});
