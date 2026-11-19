-- Student-created virtual practical attempts are distinct from ordinary guided-lab completion.
CREATE TABLE "virtual_practical_attempts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "lab_id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "lesson_id" TEXT,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "challenge_json" TEXT NOT NULL,
    "responses_json" TEXT NOT NULL DEFAULT '{}',
    "report_json" TEXT,
    "score" REAL,
    "max_score" REAL NOT NULL DEFAULT 100,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" DATETIME,
    CONSTRAINT "virtual_practical_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "virtual_practical_attempts_user_id_started_at_idx" ON "virtual_practical_attempts"("user_id", "started_at");
CREATE INDEX "virtual_practical_attempts_lab_chapter_idx" ON "virtual_practical_attempts"("lab_id", "chapter_id");
