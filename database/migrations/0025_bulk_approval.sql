-- Bulk management approval of questions. Additive only.
-- A batch is one decision by one signed-in approver. Each item keeps what the question was before, so the decision can be undone.
-- CreateTable
CREATE TABLE "bulk_approval_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "approver_id" TEXT NOT NULL,
    "approver_name" TEXT NOT NULL,
    "approver_roles" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "scope_json" TEXT NOT NULL,
    "question_count" INTEGER NOT NULL,
    "snapshot_hash" TEXT NOT NULL,
    "checks_json" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bulk_approval_batches_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bulk_approval_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batch_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "from_verification" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "ended_at" DATETIME,
    "ended_by" TEXT,
    "ended_reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bulk_approval_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "bulk_approval_batches" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bulk_approval_items_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "bulk_approval_items_batch_id_question_id_key" ON "bulk_approval_items"("batch_id", "question_id");

-- CreateIndex
CREATE INDEX "bulk_approval_items_question_id_state_idx" ON "bulk_approval_items"("question_id", "state");

-- CreateIndex
CREATE INDEX "bulk_approval_batches_created_at_idx" ON "bulk_approval_batches"("created_at");
