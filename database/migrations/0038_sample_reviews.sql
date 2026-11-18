-- Subject-expert sample review of questions. Additive only.
-- A sample review checks a representative sample of questions one by one and records what the expert found.
-- It is a SAMPLE: it never changes any question's verification and never counts as individual verification of the others.
-- CreateTable
CREATE TABLE "sample_reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope_json" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "target_size" INTEGER NOT NULL,
    "population_count" INTEGER NOT NULL,
    "sample_count" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "created_by" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expert_name" TEXT,
    "expert_credentials" TEXT,
    "completed_by" TEXT,
    "completed_by_name" TEXT,
    "completed_at" DATETIME,
    "result_json" TEXT,
    "cancel_reason" TEXT,
    CONSTRAINT "sample_reviews_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sample_review_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sample_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "stratum" TEXT NOT NULL,
    "answer_correct" BOOLEAN,
    "explanation_accurate" BOOLEAN,
    "topic_fits" BOOLEAN,
    "outcome" TEXT NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" DATETIME,
    CONSTRAINT "sample_review_items_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "sample_reviews" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sample_review_items_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "sample_review_items_sample_id_question_id_key" ON "sample_review_items"("sample_id", "question_id");

-- CreateIndex
CREATE INDEX "sample_review_items_sample_id_position_idx" ON "sample_review_items"("sample_id", "position");

-- CreateIndex
CREATE INDEX "sample_reviews_status_created_at_idx" ON "sample_reviews"("status", "created_at");
