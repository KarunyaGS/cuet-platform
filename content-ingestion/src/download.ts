/** DOWNLOAD: fetch with retries and a polite delay; verify PDFs; content-addressed cache on disk. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const UA = 'cuet-platform-syllabus-ingestion/0.1 (official syllabus inventory)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchBytes(url: string, attempts = 3): Promise<Uint8Array> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      last = e;
      await sleep(2000 * (i + 1));
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

export const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

export interface Downloaded {
  data: Uint8Array;
  sha256: string;
  retrievedAt: string;
  localFile: string;
  fromCache: boolean;
}

/** Download an official PDF once; later runs reuse the cached copy unless refresh is set. */
export async function downloadPdf(url: string, localFile: string, refresh = false): Promise<Downloaded> {
  const meta = `${localFile}.json`;
  if (!refresh && existsSync(localFile) && existsSync(meta)) {
    const data = new Uint8Array(readFileSync(localFile));
    const m = JSON.parse(readFileSync(meta, 'utf8')) as { sha256: string; retrievedAt: string; url: string };
    if (m.url === url && sha256(data) === m.sha256) return { data, sha256: m.sha256, retrievedAt: m.retrievedAt, localFile, fromCache: true };
  }
  const data = await fetchBytes(url);
  if (new TextDecoder().decode(data.slice(0, 5)) !== '%PDF-') throw new Error(`Not a PDF: ${url}`);
  const digest = sha256(data);
  const retrievedAt = new Date().toISOString();
  mkdirSync(dirname(localFile), { recursive: true });
  writeFileSync(localFile, data);
  writeFileSync(meta, JSON.stringify({ url, sha256: digest, retrievedAt }, null, 2));
  await sleep(700);
  return { data, sha256: digest, retrievedAt, localFile, fromCache: false };
}
