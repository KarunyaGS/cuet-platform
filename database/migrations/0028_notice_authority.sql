-- Government notices: which authority issued each one (NTA or UGC), and whether it was published automatically.
-- Additive. Existing notices are NTA notices; those already published by the reader are marked automatic so that a change to
-- one is re-checked.
ALTER TABLE "gov_notices" ADD COLUMN "authority" TEXT NOT NULL DEFAULT 'NTA';
ALTER TABLE "gov_notices" ADD COLUMN "auto_published" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "gov_notice_sources" ADD COLUMN "authority" TEXT NOT NULL DEFAULT 'NTA';

UPDATE "gov_notices" SET "auto_published" = 1 WHERE "verification_status" = 'PUBLISHED' AND "status_note" LIKE 'Published automatically%';

CREATE INDEX "gov_notices_authority_status_idx" ON "gov_notices"("authority", "verification_status");
