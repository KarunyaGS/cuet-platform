import { z } from 'zod';
import type { PrismaClient } from '@cuet/database';
import { conflict, invalid, notFound } from '../lib/errors';
import { newId, normaliseText, sha256Hex } from '../lib/hash';
import { insertRows, nowIso, type Row } from '../lib/sql';

const NODE_KINDS = ['PART', 'SECTION', 'COURSE', 'UNIT', 'CHAPTER', 'TOPIC', 'SUBTOPIC', 'ITEM', 'NOTE'] as const;

export const syllabusBundleSchema = z.object({
  idempotencyKey: z.string().min(8).max(200),
  exam: z.enum(['CUET_UG', 'CUET_PG']),
  year: z.number().int().min(2020).max(2100),
  paperCode: z.string().min(1).max(20),
  source: z.object({
    kind: z.literal('OFFICIAL_SYLLABUS'),
    title: z.string().min(1).max(300),
    publisher: z.string().min(1).max(120),
    url: z.url().max(1000),
    listedOnUrl: z.url().max(1000).optional(),
    retrievedAt: z.iso.datetime(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    byteSize: z.number().int().positive(),
    mimeType: z.string().max(100),
    pageCount: z.number().int().positive().max(2000),
    r2Key: z.string().max(300).optional(),
  }),
  extractor: z.object({ name: z.string().max(80), version: z.string().max(40), mode: z.string().max(40) }),
  /** Why this version needs a person (review reasons, or why extraction is blocked). Stored on the version. */
  notes: z.string().max(4000).optional(),
  /** Machine verification evidence. Without it, rows arrive UNVERIFIED. Human verification never comes through imports. */
  verification: z
    .object({
      level: z.literal('MACHINE'),
      method: z.string().min(3).max(120),
      metrics: z.record(z.string(), z.unknown()),
    })
    .optional(),
  nodes: z
    .array(
      z.object({
        ref: z.string().min(1).max(40),
        parentRef: z.string().max(40).nullable(),
        kind: z.enum(NODE_KINDS),
        label: z.string().max(40).nullable(),
        title: z.string().min(1).max(1000),
        body: z.string().max(20000).nullable(),
        position: z.number().int().min(0),
        depth: z.number().int().min(1).max(12),
        sourcePage: z.number().int().min(1).nullable(),
        flags: z.array(z.string().max(120)).max(20),
        /** This row's automatic check against its source page, kept so reviewers can see exactly what failed. */
        check: z
          .object({
            ok: z.boolean(),
            missingOnPage: z.array(z.string().max(200)).max(200),
            secondExtractorAgreementPct: z.number().min(0).max(100),
            flags: z.array(z.string().max(120)).max(20),
          })
          .optional(),
      }),
    )
    .max(5000),
  tables: z
    .array(
      z.object({
        nodeRef: z.string().max(40).nullable(),
        page: z.number().int().min(1),
        rows: z.array(z.array(z.string().max(2000)).max(30)).min(1).max(300),
      }),
    )
    .max(300)
    .default([]),
  figures: z
    .array(
      z.object({
        nodeRef: z.string().max(40).nullable(),
        page: z.number().int().min(1),
        r2Key: z.string().max(300),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
        mimeType: z.string().max(100),
        byteSize: z.number().int().positive(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      }),
    )
    .max(300)
    .default([]),
});
export type SyllabusBundle = z.infer<typeof syllabusBundleSchema>;

export interface ImportResult {
  status: 'IMPORTED' | 'DUPLICATE';
  importRunId: string;
  testPaperId: string;
  syllabusVersionId: string;
  versionNumber: number;
  sourceDocumentId: string;
  nodesCreated: number;
  duplicateNodesSkipped: number;
  tablesCreated: number;
  figuresCreated: number;
  figuresAlreadyKnown: number;
  warnings: string[];
}

/** Structural checks the schema cannot express. Returns warnings; throws on hard errors. */
export function validateBundleStructure(bundle: SyllabusBundle): string[] {
  const warnings: string[] = [];
  const refs = new Map<string, { depth: number; index: number }>();
  bundle.nodes.forEach((n, index) => {
    if (refs.has(n.ref)) throw invalid(`Duplicate node ref ${n.ref}`);
    if (n.parentRef !== null) {
      const parent = refs.get(n.parentRef);
      if (!parent) throw invalid(`Node ${n.ref} points at parent ${n.parentRef}, which is missing or comes later`);
      if (n.depth !== parent.depth + 1) throw invalid(`Node ${n.ref} has depth ${n.depth}; its parent has ${parent.depth}`);
    } else if (n.depth !== 1) {
      throw invalid(`Top-level node ${n.ref} must have depth 1`);
    }
    if (n.sourcePage !== null && n.sourcePage > bundle.source.pageCount) {
      throw invalid(`Node ${n.ref} cites page ${n.sourcePage}, but the document has ${bundle.source.pageCount} pages`);
    }
    refs.set(n.ref, { depth: n.depth, index });
  });
  for (const t of bundle.tables) if (t.nodeRef && !refs.has(t.nodeRef)) throw invalid(`Table points at unknown node ${t.nodeRef}`);
  for (const f of bundle.figures) if (f.nodeRef && !refs.has(f.nodeRef)) throw invalid(`Figure points at unknown node ${f.nodeRef}`);
  if (bundle.nodes.length === 0) warnings.push('No curriculum nodes were extracted from this document');
  if (bundle.verification && bundle.nodes.some((n) => n.flags.some((f) => f.startsWith('heading_inferred') || f === 'ocr' || f.startsWith('ocr_')))) {
    throw invalid('A machine-verified import cannot contain guessed headings or OCR rows');
  }
  return warnings;
}

export async function importSyllabus(prisma: PrismaClient, db: D1Database, bundle: SyllabusBundle, actor: string): Promise<ImportResult> {
  const warnings = validateBundleStructure(bundle);

  // 1. Idempotency: the same request twice returns the first result.
  const previous = await prisma.importRun.findUnique({ where: { idempotencyKey: bundle.idempotencyKey } });
  if (previous?.status === 'SUCCEEDED' || previous?.status === 'DUPLICATE') {
    // Same request again: nothing is written; say so, and return the original result for reference.
    return { ...(JSON.parse(previous.statsJson ?? '{}') as ImportResult), replayed: true } as ImportResult & { replayed: true };
  }
  if (previous) throw conflict('An import with this key is already running or failed; use a new key to retry', { importRunId: previous.id });

  const cycle = await prisma.examCycle.findFirst({ where: { year: bundle.year, exam: { code: bundle.exam } } });
  if (!cycle) throw notFound(`Exam cycle ${bundle.exam} ${bundle.year}`);
  const paper = await prisma.testPaper.findUnique({ where: { examCycleId_code: { examCycleId: cycle.id, code: bundle.paperCode } } });
  if (!paper) throw notFound(`Paper ${bundle.paperCode} in ${bundle.exam} ${bundle.year} (register the official paper list first)`);

  const now = nowIso();
  const importRunId = newId('imp');
  const verification = bundle.verification ? 'MACHINE_VERIFIED' : 'UNVERIFIED';

  // 2. Duplicate document: same bytes already imported for this paper -> no new rows.
  const existingSource = await prisma.sourceDocument.findUnique({ where: { sha256: bundle.source.sha256 } });
  if (existingSource) {
    const existingVersion = await prisma.syllabusVersion.findFirst({
      where: { testPaperId: paper.id, sourceDocumentId: existingSource.id },
      orderBy: { versionNumber: 'desc' },
    });
    if (existingVersion) {
      const result: ImportResult = {
        status: 'DUPLICATE', importRunId, testPaperId: paper.id, syllabusVersionId: existingVersion.id,
        versionNumber: existingVersion.versionNumber, sourceDocumentId: existingSource.id, nodesCreated: 0,
        duplicateNodesSkipped: bundle.nodes.length, tablesCreated: 0, figuresCreated: 0, figuresAlreadyKnown: bundle.figures.length,
        warnings: ['This exact document (same SHA-256) was already imported for this paper; nothing new was written'],
      };
      await db.batch([
        ...insertRows(db, 'import_runs', [{
          id: importRunId, idempotency_key: bundle.idempotencyKey, kind: 'SYLLABUS', source_document_id: existingSource.id,
          status: 'DUPLICATE', stats_json: JSON.stringify(result), errors_json: null, actor, started_at: now, finished_at: now,
        }]),
        jobUpdate(db, bundle.source.url, 'IMPORTED', 'SUCCEEDED', paper.id, existingSource.id, bundle.source.sha256, null, now),
      ]);
      return result;
    }
  }

  // 3. New syllabus version for this paper.
  const latest = await prisma.syllabusVersion.findFirst({ where: { testPaperId: paper.id }, orderBy: { versionNumber: 'desc' } });
  const versionNumber = (latest?.versionNumber ?? 0) + 1;
  const versionId = newId('sv');
  const sourceId = existingSource?.id ?? newId('src');

  // 4. Nodes: hash each one with its ancestor path; skip exact duplicates under the same path.
  const idByRef = new Map<string, string>();
  const pathByRef = new Map<string, string>();
  const seenHash = new Map<string, string>();
  const nodeRows: Row[] = [];
  let duplicateNodesSkipped = 0;
  for (const n of bundle.nodes) {
    const parentPath = n.parentRef ? pathByRef.get(n.parentRef)! : '';
    const path = `${parentPath}/${n.kind}:${normaliseText(n.label)}:${normaliseText(n.title)}`;
    const hash = await sha256Hex(`${path}|${normaliseText(n.body)}`);
    pathByRef.set(n.ref, path);
    const dup = seenHash.get(hash);
    if (dup) {
      idByRef.set(n.ref, dup);
      duplicateNodesSkipped++;
      continue;
    }
    const id = newId('cn');
    seenHash.set(hash, id);
    idByRef.set(n.ref, id);
    nodeRows.push({
      id, syllabus_version_id: versionId, parent_id: n.parentRef ? idByRef.get(n.parentRef)! : null, kind: n.kind,
      label: n.label, title: n.title, body: n.body, position: n.position, depth: n.depth, source_page: n.sourcePage,
      extraction_flags: n.flags.length ? n.flags.join(',') : null, content_hash: hash, verification, check_json: n.check ? JSON.stringify(n.check) : null,
      created_at: now, updated_at: now,
    });
  }
  if (duplicateNodesSkipped) warnings.push(`${duplicateNodesSkipped} node(s) repeated exactly under the same heading and were merged`);

  // 5. Tables and figures.
  const tableRows: Row[] = [];
  const tableHashes = new Set<string>();
  for (const t of bundle.tables) {
    const rowsJson = JSON.stringify(t.rows);
    const hash = await sha256Hex(`${t.page}|${rowsJson}`);
    if (tableHashes.has(hash)) continue;
    tableHashes.add(hash);
    tableRows.push({
      id: newId('tbl'), source_document_id: sourceId, curriculum_node_id: t.nodeRef ? idByRef.get(t.nodeRef)! : null, page: t.page,
      rows_json: rowsJson, row_count: t.rows.length, column_count: Math.max(...t.rows.map((r) => r.length)), content_hash: hash,
      verification: 'UNVERIFIED', created_at: now,
    });
  }
  const figureShas = [...new Set(bundle.figures.map((f) => f.sha256))];
  const knownFigures = figureShas.length
    ? new Set((await prisma.mediaAsset.findMany({ where: { sha256: { in: figureShas } }, select: { sha256: true } })).map((m) => m.sha256))
    : new Set<string | null>();
  const figureRows: Row[] = [];
  const addedFigure = new Set<string>();
  for (const f of bundle.figures) {
    if (knownFigures.has(f.sha256) || addedFigure.has(f.sha256)) continue;
    addedFigure.add(f.sha256);
    figureRows.push({
      id: newId('med'), kind: 'IMAGE', r2_key: f.r2Key, external_url: null, mime_type: f.mimeType, byte_size: f.byteSize,
      sha256: f.sha256, width: f.width, height: f.height, duration_seconds: null,
      alt_text: `Figure from page ${f.page} of "${bundle.source.title}". Description pending human review.`,
      caption: null, long_description: null, language: 'en', attribution: `${bundle.source.publisher}: ${bundle.source.title}`,
      usage_permission_id: 'perm_nta_reference', source_document_id: sourceId, source_page: f.page,
      curriculum_node_id: f.nodeRef ? idByRef.get(f.nodeRef)! : null, origin: 'OFFICIAL_SOURCE', status: 'DRAFT',
      verification: 'UNVERIFIED', created_at: now, updated_at: now,
    });
  }

  const result: ImportResult = {
    status: 'IMPORTED', importRunId, testPaperId: paper.id, syllabusVersionId: versionId, versionNumber, sourceDocumentId: sourceId,
    nodesCreated: nodeRows.length, duplicateNodesSkipped, tablesCreated: tableRows.length, figuresCreated: figureRows.length,
    figuresAlreadyKnown: bundle.figures.length - figureRows.length, warnings,
  };

  // 6. One atomic batch: everything is written or nothing is.
  const s = bundle.source;
  await db.batch([
    ...(existingSource
      ? []
      : insertRows(db, 'source_documents', [{
          id: sourceId, kind: s.kind, title: s.title, publisher: s.publisher, url: s.url, listed_on_url: s.listedOnUrl ?? null,
          retrieved_at: s.retrievedAt, sha256: s.sha256, byte_size: s.byteSize, mime_type: s.mimeType, page_count: s.pageCount,
          r2_key: s.r2Key ?? null, usage_permission_id: 'perm_nta_reference', verification: 'UNVERIFIED',
          notes: 'Official document. Reference copy kept privately; do not republish.', created_at: now, updated_at: now,
        }])),
    ...insertRows(db, 'syllabus_versions', [{
      id: versionId, test_paper_id: paper.id, version_number: versionNumber, source_document_id: sourceId, status: 'DRAFT',
      verification, is_demonstration: false, extracted_at: now, published_at: null,
      notes: bundle.verification
        ? `Machine-extracted by ${bundle.extractor.name} ${bundle.extractor.version} (${bundle.extractor.mode}); machine-verified by ${bundle.verification.method}. Not yet signed off by a person.`
        : `Machine-extracted by ${bundle.extractor.name} ${bundle.extractor.version} (${bundle.extractor.mode}). Not verified.${bundle.notes ? ` ${bundle.notes}` : ''}`,
      created_at: now, updated_at: now,
    }]),
    ...(bundle.verification
      ? insertRows(db, 'verification_evidence', [{
          id: newId('ver'), entity_type: 'SYLLABUS_VERSION', entity_id: versionId, level: 'MACHINE', method: bundle.verification.method,
          metrics_json: JSON.stringify(bundle.verification.metrics), verified_by: actor, created_at: now,
        }])
      : []),
    ...insertRows(db, 'curriculum_nodes', nodeRows),
    ...insertRows(db, 'source_tables', tableRows),
    ...insertRows(db, 'media_assets', figureRows),
    ...insertRows(db, 'source_references', [{
      id: newId('ref'), source_document_id: sourceId, entity_type: 'SYLLABUS_VERSION', entity_id: versionId, page: null,
      locator: 'whole document', created_at: now,
    }]),
    ...insertRows(db, 'import_runs', [{
      id: importRunId, idempotency_key: bundle.idempotencyKey, kind: 'SYLLABUS', source_document_id: sourceId, status: 'SUCCEEDED',
      stats_json: JSON.stringify(result), errors_json: null, actor, started_at: now, finished_at: now,
    }]),
    ...insertRows(db, 'audit_logs', [{
      id: newId('aud'), actor, action: 'IMPORT_SYLLABUS', entity_type: 'SYLLABUS_VERSION', entity_id: versionId,
      detail_json: JSON.stringify({ paper: bundle.paperCode, exam: bundle.exam, year: bundle.year, nodes: nodeRows.length }), created_at: now,
    }]),
    jobUpdate(db, s.url, 'IMPORTED', 'SUCCEEDED', paper.id, sourceId, s.sha256, null, now),
  ]);
  return result;
}

function jobUpdate(
  db: D1Database, url: string, stage: string, status: string, paperId: string, sourceId: string, sha: string,
  reason: string | null, now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE extraction_jobs SET stage = ?, status = ?, test_paper_id = ?, source_document_id = ?, sha256 = ?,
       blocker_reason = ?, last_error = NULL, updated_at = ? WHERE source_url = ?`,
    )
    .bind(stage, status, paperId, sourceId, sha, reason, now, url);
}
