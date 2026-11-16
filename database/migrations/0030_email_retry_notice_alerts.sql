-- Email: later retries of failed sends, and emails about new official notices. Additive only.
-- A failed email of a harmless kind (study reminder, account notice, notice alert) keeps its subject and text only until it is
-- sent, expires or is given up on; the body is then erased. Emails that carry a one-time link (password reset, address
-- confirmation) are never kept: the student asks again instead.
ALTER TABLE "email_messages" ADD COLUMN "retry_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "email_messages" ADD COLUMN "next_attempt_at" DATETIME;
ALTER TABLE "email_messages" ADD COLUMN "retry_until" DATETIME;
ALTER TABLE "email_messages" ADD COLUMN "payload_json" TEXT;
CREATE INDEX "email_messages_status_next_attempt_at_idx" ON "email_messages"("status", "next_attempt_at");

-- Notice alerts are opt-in. The cursor is the moment the student turned them on (or the last alert), so nobody receives a backlog.
ALTER TABLE "student_preferences" ADD COLUMN "email_notices" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "student_preferences" ADD COLUMN "notice_cursor" DATETIME;
