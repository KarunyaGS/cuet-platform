-- Study planner: generated plans. Additive only: new nullable columns on study_plan_items (existing rows keep working), and two new tables.
-- (Written by hand from the generated draft so that it touches nothing but the planner.)
ALTER TABLE "study_plan_items" ADD COLUMN "plan_id" TEXT;
ALTER TABLE "study_plan_items" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'STUDENT';
ALTER TABLE "study_plan_items" ADD COLUMN "original_day" TEXT;
ALTER TABLE "study_plan_items" ADD COLUMN "suggestion_key" TEXT;
ALTER TABLE "study_plan_items" ADD COLUMN "depends_on" TEXT;
ALTER TABLE "study_plan_items" ADD COLUMN "subject_code" TEXT;
ALTER TABLE "study_plan_items" ADD COLUMN "minutes" INTEGER;
ALTER TABLE "study_plan_items" ADD COLUMN "target_count" INTEGER;
ALTER TABLE "study_plan_items" ADD COLUMN "note" TEXT;
ALTER TABLE "study_plan_items" ADD COLUMN "evidence" TEXT;
ALTER TABLE "study_plan_items" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "study_plan_items" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "study_plan_items" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'SCHEDULED';
ALTER TABLE "study_plan_items" ADD COLUMN "done_by" TEXT;
ALTER TABLE "study_plan_items" ADD COLUMN "done_at" DATETIME;
CREATE INDEX "study_plan_items_plan_id_idx" ON "study_plan_items"("plan_id");

-- CreateTable
CREATE TABLE "study_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "exam_code" TEXT NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "start_day" TEXT NOT NULL,
    "end_day" TEXT NOT NULL,
    "minutes_per_day" INTEGER NOT NULL,
    "goal_json" TEXT NOT NULL,
    "original_json" TEXT NOT NULL,
    "evidence_json" TEXT NOT NULL,
    "generator_version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "paused_on" TEXT,
    "light_days_json" TEXT NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "study_plan_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plan_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "detail_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables

-- CreateIndex
CREATE INDEX "study_plans_user_id_status_idx" ON "study_plans"("user_id", "status");

-- CreateIndex
CREATE INDEX "study_plan_events_plan_id_created_at_idx" ON "study_plan_events"("plan_id", "created_at");
