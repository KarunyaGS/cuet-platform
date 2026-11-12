import { ApiError, invalid } from '../lib/errors';
import { sha256Hex } from '../lib/hash';

const EXT_BY_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
};

export interface StoredObject {
  r2Key: string;
  sha256: string;
  byteSize: number;
  mimeType: string;
  alreadyStored: boolean;
}

/**
 * Store bytes in the MEDIA bucket under a content-addressed key: `<prefix>/<sha256>.<ext>`.
 * The same bytes always land on the same key, so re-uploads never duplicate storage.
 * Locally the bucket is Wrangler's on-disk R2 simulation.
 */
export async function storeObject(
  bucket: R2Bucket, prefix: 'sources' | 'media', body: ArrayBuffer, mimeType: string, maxBytes: number,
): Promise<StoredObject> {
  const ext = EXT_BY_TYPE[mimeType];
  if (!ext) throw invalid(`Unsupported file type ${mimeType}`);
  if (body.byteLength === 0) throw invalid('Empty file');
  if (body.byteLength > maxBytes) throw new ApiError(413, 'TOO_LARGE', `File is larger than ${maxBytes} bytes`);
  if (mimeType === 'application/pdf' && new TextDecoder().decode(body.slice(0, 5)) !== '%PDF-') throw invalid('File is not a PDF');
  const sha256 = await sha256Hex(body);
  const r2Key = `${prefix}/${sha256}.${ext}`;
  const existing = await bucket.head(r2Key);
  if (!existing) {
    await bucket.put(r2Key, body, { httpMetadata: { contentType: mimeType }, customMetadata: { sha256 }, sha256 });
  }
  return { r2Key, sha256, byteSize: body.byteLength, mimeType, alreadyStored: Boolean(existing) };
}
