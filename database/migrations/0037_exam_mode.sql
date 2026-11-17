-- Examination mode for mock tests: why an attempt ended, and every integrity event reported during it.

ALTER TABLE "practice_sessions" ADD COLUMN "end_reason" TEXT;

CREATE TABLE "exam_violations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurred_at" TEXT NOT NULL,
    "recorded_at" TEXT NOT NULL,
    "detail" TEXT,
    "action" TEXT NOT NULL,
    CONSTRAINT "exam_violations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "practice_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "exam_violations_session_id_recorded_at_idx" ON "exam_violations"("session_id", "recorded_at");
CREATE INDEX "exam_violations_user_id_idx" ON "exam_violations"("user_id");
