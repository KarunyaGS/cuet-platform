# Previous-year papers

Status on 13 November 2026: the module is built and tested locally. **No paper has been imported**, because no source that permits it exists yet (see "Source position").

## Source position

> **Correction, 13 November 2026 (later):** a deeper search found question-paper files on NTA's own server for 14 CUET (PG) 2024 subjects. The statement in this document that NTA publishes no CUET question papers is true for 2025 and 2026 only. See `docs/official-directory.md`.

Read on 13 November 2026 (details in `docs/provider-and-source-research-2026-11-13.md`):

- NTA publishes the **final answer keys** openly. They hold a question id and the correct option id, with no question text.
- NTA does **not** publish the CUET question papers openly. Each candidate sees only their own paper after logging in.
- NTA's copyright policy allows reproduction only "after taking proper permission from National Testing Agency (NTA)".

So today there is no official, permitted source of question text. Papers copied from coaching sites or from candidates' response sheets are neither official nor licensed, and the module is built to keep them out.

What unlocks the module: written permission from NTA, or a licence from a publisher that holds one. The permission is then recorded as a row in `usage_permissions` with public display allowed, and papers are imported under it.

## What the module does

| Requirement | How it is met |
|---|---|
| Store exam, year, subject, question, answer key and source references | `past_papers` (exam, year, subject code and name, exam date, shift, language, rules) and `past_paper_questions` (number, official question id, source page, official key), with the question text, options and key in the existing question tables |
| Source traceability | Every paper must cite its source document: address, SHA-256, retrieval date, page count. Every question cites its page. The answer key is a second source document |
| Validate answer keys | The import refuses a paper if any stored key differs from the official key it cites, if a key points beyond the options, or if any question number is unaccounted for |
| Dropped questions and double keys | A question the exam body dropped keeps its number but is not asked, and the time is reduced to match. Where the official key accepts two options, either one earns the marks |
| Browsing and filtering | `/past-papers`: by exam, year and subject |
| Practice and mock workflows | A paper can be attempted under exam conditions (its own order, time and marking) or as untimed practice. Results, review and progress use the existing screens |
| No unverified or unlicensed material | See the gates below |

## Gates that cannot be switched off

1. **Import** stores a paper only as a draft. A tool can never publish.
2. **Students see a paper only when it is published and its permission allows public display.** The local preview setting, which shows draft lessons, does not apply to previous-year papers.
3. **Publishing** is done by a signed-in member of staff and is refused unless:
   - the permission allows display;
   - an official answer key is recorded and it is the final one;
   - a reviewer has verified every question against the paper.
4. Until a paper is published, its questions belong to no subject, so they cannot appear in ordinary practice or tests.
5. Once a reviewer has worked on a paper, an import cannot overwrite it.

## Adding a paper

One JSON file per paper under `content/past-papers/<EXAM>/<year>/`.

```
npm run ingest -- pyq-validate     checks every pack; writes nothing
npm run ingest -- pyq-import       stores valid packs as drafts
```

Then a reviewer verifies each question on the reviewer screen, and an administrator publishes the paper in the admin console under **Previous-year papers**, which lists whatever still blocks it.

Pack format (`cuet-past-paper/1`):

```json
{
  "schema": "cuet-past-paper/1",
  "exam": "CUET_UG", "year": 2025, "subjectCode": "322", "subjectName": "Physics",
  "examDate": "2025-05-20", "shift": "Shift 1", "language": "en",
  "title": "Physics, 20 May 2025, Shift 1",
  "rules": { "questionsInPaper": 50, "durationMinutes": 60, "marksCorrect": 5, "marksIncorrect": -1 },
  "usagePermission": "<code of a row in usage_permissions>",
  "questionPaperSource": { "title": "...", "publisher": "...", "url": "https://...", "retrievedAt": "2026-11-13T00:00:00.000Z", "sha256": "<64 hex>", "byteSize": 123456, "mimeType": "application/pdf", "pageCount": 20 },
  "answerKeySource": { "...": "same fields, for the official final answer key" },
  "keyVersion": "FINAL",
  "questions": [
    { "position": 1, "type": "MCQ_SINGLE", "stem": "...", "sourcePage": 2, "officialQuestionId": "...",
      "options": [{ "label": "A", "text": "..." }, { "label": "B", "text": "..." }],
      "correctOptionPositions": [2], "officialKey": [2] },
    { "position": 2, "dropped": true }
  ]
}
```

## Where the code is

| Part | File |
|---|---|
| Import checks, visibility, start, publishing | `backend/src/services/past-papers.ts` |
| Routes | `/api/learn/past-papers`, `/api/student/past-papers/:id/start`, `/api/admin/past-papers` (import), `/api/console/past-papers` (staff) |
| Tables | migration `0015_past_papers.sql` |
| Screens | `frontend/src/pages/PastPapers.tsx`, `frontend/src/admin/PastPapers.tsx` |
| Import tool | `content-ingestion/src/past-papers.ts` |
| Tests | `backend/test/past-papers.test.ts` (5 tests, using a made-up sample paper) |

## Not built yet

- Reading NTA's answer-key PDFs automatically. The official key is typed into the pack today; the import then checks the stored key against it.
- A per-paper filter on the reviewer screen. Reviewers find the questions under "All subjects" for now.
- Showing on the results page which previous-year paper an attempt came from.
