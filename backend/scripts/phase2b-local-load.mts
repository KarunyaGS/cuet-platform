/**
 * One-off, LOCAL ONLY (Phase 2B): reads the 109 programmes' printed subject rules into DRAFT requirements, enters Delhi's List A and
 * List B as DRAFT lists, and prepares reviewer drafts for the BHU and the three partly read programmes. It writes through the same service
 * functions the admin console uses, so every step leaves its history. It publishes and approves NOTHING: a person does that in the console.
 *
 *   npx tsx scripts/phase2b-local-load.mts [--check]       --check reports what would be done and writes nothing
 *
 * Run from `backend/`. It uses the local database that `wrangler dev` uses (.wrangler/state). Never run against production.
 */
import { getPlatformProxy } from 'wrangler';
import { createGroup, decideRequirement, groupInputSchema, listRequirements, proposeRequirements, requirementDetail, reviseRequirement, type StoredRule } from '../src/services/admission-review';

const ACTOR = 'script:phase-2b (prepared by Claude Code; awaiting a reviewer)';
const checkOnly = process.argv.includes('--check');
const TODAY = new Date().toISOString().slice(0, 10);
const ACADEMIC_YEAR = '2026-27';

const { env, dispose } = await getPlatformProxy<{ DB: D1Database }>({ configPath: new URL('../wrangler.jsonc', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
const db = env.DB;

try {
  // The migration must have been applied locally first.
  await db.prepare('SELECT COUNT(*) AS n FROM admission_requirements').first();

  // ---- 1. read every printed rule as a DRAFT
  const proposed = await proposeRequirements(db, ACTOR, { dryRun: checkOnly });
  console.log('1. Requirements read:', JSON.stringify(proposed));

  // ---- 2. Delhi's lists, exactly as printed in the Bulletin of Information (UG) 2026-27, PDF p.20 / printed p.xvi
  const du = await db.prepare(`SELECT id FROM admission_sources WHERE url = 'https://admission.uod.ac.in' AND status = 'APPROVED'`).first<{ id: string }>();
  if (!du) throw new Error('The Delhi source is not approved locally');
  const BULLETIN = 'Bulletin of Information UG 2026-27 (https://www.du.ac.in/uploads/2026/06012026_BOI_UG_2026_27_compressed.pdf), PDF p.20 / printed p.xvi';
  const lists = [
    {
      groupCode: 'LIST_A' as const, title: 'List A: Languages',
      names: ['Assamese', 'Bengali', 'English', 'Gujarati', 'Hindi', 'Kannada', 'Malayalam', 'Marathi', 'Odia', 'Punjabi', 'Sanskrit', 'Tamil', 'Telugu', 'Urdu'],
    },
    {
      groupCode: 'LIST_B' as const, title: 'List B: Domain Specific Subjects',
      names: [
        'Accountancy / Book Keeping', 'Agriculture', 'Anthropology', 'Biology / Biological Science / Biotechnology / Biochemistry', 'Business Studies', 'Chemistry', 'Computer Science / Information Practices',
        'Economics / Business Economics', 'Environmental Studies/Environmental Science', 'Fine Arts / Visual Arts (Sculpture/Painting) /Commercial Arts', 'Geography / Geology', 'History', 'Home Science',
        'Knowledge Tradition and Practices in India', 'Mass Media / Mass Communication', 'Mathematics/ Applied Mathematics', 'Performing Arts (Dance, Drama, Music)', 'Physical Education (Yoga, Sports)',
        'Physics', 'Political Science', 'Psychology', 'Sociology',
      ],
    },
  ];
  for (const l of lists) {
    const existing = await db.prepare(`SELECT id FROM admission_groups WHERE university_slug = 'university-of-delhi' AND group_code = ? AND academic_year = ? AND exam_code = 'CUET_UG'`).bind(l.groupCode, ACADEMIC_YEAR).first();
    if (existing) { console.log(`2. ${l.groupCode}: already entered, left as it is`); continue; }
    const input = groupInputSchema.parse({
      universitySlug: 'university-of-delhi', groupCode: l.groupCode, title: l.title, academicYear: ACADEMIC_YEAR, exam: 'CUET_UG', sourceId: du.id, sourcePage: 20, sourceLocator: BULLETIN, checkedOn: TODAY,
      members: l.names.map((printedName) => ({ printedName })),
    });
    if (checkOnly) { console.log(`2. ${l.groupCode}: would enter ${l.names.length} names (DRAFT)`); continue; }
    const g = await createGroup(db, input, ACTOR);
    const attention = g.members.filter((m) => m.mapping_status !== 'MAPPED').map((m) => `${m.printed_name} [${m.mapping_status}${m.paper_code ? ` -> ${m.paper_code}` : ''}]`);
    console.log(`2. ${l.groupCode}: entered ${g.members.length} names as DRAFT; needing a person: ${attention.join(', ') || 'none'}`);
  }

  if (!checkOnly) {
    // ---- 3. BHU: ask the university (nothing is decided here)
    const all = (await listRequirements(db, { limit: 200, offset: 0 })).items;
    const bhu = all.filter((r) => r.programme.universitySlug === 'banaras-hindu-university' && r.status === 'DRAFT' && r.openIssues.some((i) => i.code === 'ALL_OR_ANY_NOT_STATED'));
    const EVIDENCE =
      'BHU\'s documents do not say whether every numbered paper in a set is needed or only some. Checked 20 Nov 2026: UG Information Bulletin 2026-27 (final draft 23 Mar 2026) lists the CUET papers per programme under "CUET NTA Entrance Subject with Code for Admission" as numbered lists joined by OR, with no sentence on all or any; ' +
      'CAP-UG 2026 section 4.1 (PDF p.9) says only that the candidate should have appeared in the NTA CUET (UG) 2026 test paper(s) "required for registered course"; the admission-portal FAQ says "required subjects". ' +
      'None settles it. A written answer from BHU admissions is needed (draft question in docs/completion/phase-2b-requests-for-universities-2026-11-20.md; not sent).';
    for (const r of bhu) {
      await decideRequirement(db, r.id, { action: 'NEEDS_UNIVERSITY_CONFIRMATION', note: EVIDENCE }, ACTOR);
    }
    console.log(`3. BHU: ${bhu.length} requirements marked as waiting for the university`);

    // ---- 4. the three partly read programmes: reviewer drafts, clearly marked, nothing approved
    const find = (uni: string, name: string) => all.find((r) => r.programme.universitySlug === uni && r.programme.name === name && r.status === 'DRAFT');
    const revise = async (id: string, edit: (rule: StoredRule) => { combinations: unknown[]; resolutions?: Record<string, { note: string; sourceUrl?: string }> }, note: string) => {
      const d = await requirementDetail(db, id);
      const e = edit(d.rule);
      return reviseRequirement(db, id, { combinations: e.combinations as never, extraTests: d.rule.extraTests as never, resolutions: e.resolutions ?? {}, note }, ACTOR);
    };

    const sanskrit = find('university-of-delhi', 'B.A. (Hons.) Sanskrit');
    if (sanskrit) {
      const r = await revise(
        sanskrit.id,
        (rule) => {
          const fix = (reqs: unknown[]) => (reqs as { kind: string; subject?: { status: string; text: string } }[]).map((q) =>
            q.kind === 'SUBJECT' && q.subject?.status === 'AMBIGUOUS'
              ? { ...q, subject: { status: 'MAPPED', text: q.subject.text, subjectId: 'sanskrit', paperCode: '325', basis: 'PAPER_CODE', note: 'Delhi lists Sanskrit among the languages of List A (Bulletin p.20); NTA\'s only Sanskrit paper in the 2026 list is 325 (a domain paper). Proposed match, to be confirmed.' } }
              : q);
          return { combinations: rule.combinations.map((c) => ({ label: c.label, requirements: fix(c.requirements), effective: fix(c.effective) })) };
        },
        'Sanskrit mapped to NTA paper 325 as a proposal: the Bulletin names it in List A (languages) and 325 is the only Sanskrit paper NTA lists for 2026. The same entry in the List A draft is awaiting a person\'s confirmation.',
      );
      console.log(`4a. Delhi Sanskrit: revised draft v${r.version} (${r.openIssues.length} open issues)`);
    }

    const bvoc = find('university-of-delhi', 'B.Voc. Health Care Management');
    if (bvoc) {
      const r = await revise(
        bvoc.id,
        (rule) => {
          const fix = (reqs: unknown[]) => (reqs as { kind: string; text?: string }[]).map((q) => (q.kind === 'UNRESOLVED' && /either List B/i.test(q.text ?? '') ? { kind: 'ANY_N_OF_GROUP', n: 1, group: 'LIST_B', otherThanNamed: false } : q));
          return { combinations: rule.combinations.map((c) => ({ label: c.label, requirements: fix(c.requirements), effective: fix(c.effective) })) };
        },
        'Combination III prints "Any one subject from either List B" (Bulletin PDF p.50). The sibling programme B.Voc. Retail Management and IT prints the same combination as "from List B". Proposed reading: any one subject from List B. Delhi should confirm the printed wording.',
      );
      await decideRequirement(db, r.id, { action: 'NEEDS_UNIVERSITY_CONFIRMATION', note: 'The printed wording is odd ("either List B"); a reading is proposed from the sibling programme but Delhi has not confirmed it.' }, ACTOR);
      console.log(`4b. Delhi B.Voc. Health Care Management: revised draft v${r.version}, waiting for Delhi's confirmation`);
    }

    const ayurveda = find('jawaharlal-nehru-university', 'B.Sc. in Ayurveda Biology (AYBU 411)');
    if (ayurveda) {
      const r = await revise(
        ayurveda.id,
        (rule) => ({
          combinations: rule.combinations.map((c) => ({ label: c.label, requirements: c.requirements, effective: c.effective })),
          resolutions: {
            UNSUPPORTED_CLAUSE: { note: 'Read by a person from the printed text: Physics and Chemistry are compulsory; the third paper is Biology or Mathematics. If both are taken, the higher marks are used for merit (a merit rule, not a minimum-eligibility rule, and not modelled).' },
            SLASH_READ_AS_CHOICE: { note: 'The printed text says "any one subject either Biology (304) or Mathematics (319) as third subject", so the slash is a choice of one.' },
          },
        }),
        'Prose rule structured by a reviewer draft: Physics (322) + Chemistry (306) + one of Biology (304) or Mathematics (319).',
      );
      console.log(`4c. JNU Ayurveda Biology: revised draft v${r.version} (${r.openIssues.length} open issues)`);
    }
  }

  const summary = await listRequirements(db, { limit: 1, offset: 0, all: '1' });
  console.log('Status of all requirement records:', JSON.stringify(summary.byStatus));
} finally {
  await dispose();
}
