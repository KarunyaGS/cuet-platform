-- Study planner: milestone history, so a celebration is shown once. Additive only: one new table, nothing existing is touched.
CREATE TABLE "plan_milestones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "milestone_key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject_code" TEXT,
    "priority" INTEGER NOT NULL,
    "detail_json" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reached_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shown_at" DATETIME,
    "dismissed_at" DATETIME
);

CREATE UNIQUE INDEX "plan_milestones_user_id_milestone_key_key" ON "plan_milestones"("user_id", "milestone_key");
CREATE INDEX "plan_milestones_user_id_status_idx" ON "plan_milestones"("user_id", "status");
