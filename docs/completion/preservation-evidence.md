# Database and content preservation evidence – 16 Nov 2026

Local database only (production was not touched). Snapshots: `evidence/db-snapshot-2026-11-16-before-sprint.json` and `evidence/db-snapshot-2026-11-16-sprint-end.json` (row count and content hash per table; made by a read-only script).

| Check | Result |
|---|---|
| Tables | 81 before, 82 after (new `rate_limits`, migration 0034) |
| Row-count changes | `audit_logs` 1483 → 1485 (audit rows written by the flag resolution and a test reset-link request), `d1_migrations` 33 → 34, `rate_limits` new (0 rows). **No other table changed its row count.** |
| Publication state | Admissions: 4 programmes + 8 facts PUBLISHED (Delhi), 105 programmes + 178 facts DRAFT – unchanged. Learning content: nothing published, 787 questions / 31 lessons / 194 papers still DRAFT as before. |
| Deliberate content edits | JNU 16 eligibility facts replaced by the full prospectus text and BHU 22 flags narrowed (script `resolve-flags-2026-11-16.mts`, audit row `ADMISSION_FLAGS_RESOLVED`). Still DRAFT. Flag count now 23. |
| Integrity | `PRAGMA integrity_check` ok; `foreign_key_check` 0 rows; all orphan checks 0 (see `content-data-audit-2026-11-16.md`). |
| Deleted / overwritten / skipped | Nothing deleted. The only overwrite is the approved flag-resolution above. Housekeeping (deletes expired sessions and used links after 30 days) is new code, **not yet run on any real data**. |
| Test databases | Integration trace (144/144) and the browser tests run on throwaway copies that are deleted afterwards. |

Note: the earlier snapshots used a different hashing method for some tables, so only row counts and states are compared; the JNU/BHU text edits are the one known content change.
