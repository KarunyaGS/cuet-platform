-- Admissions information. Additive only.
-- A source is an official page the platform may take facts from. It starts as PROPOSED and is used only after a member of staff
-- approves it. A fact (an admission date, eligibility as printed, or a cut-off) always cites an approved source, the page it came
-- from and the day it was checked, and is shown to students only after a member of staff publishes it.
-- Nothing here stores candidates' names or roll numbers: lists of candidates are linked to, never stored.
CREATE TABLE "admission_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "university_slug" TEXT,
    "university_name" TEXT,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "covers" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "update_frequency" TEXT,
    "reliability_note" TEXT,
    "personal_data_risk" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "recommendation" TEXT NOT NULL DEFAULT 'NOT_VERIFIED',
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "reviewed_by" TEXT,
    "reviewed_at" DATETIME,
    "last_checked_on" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "admission_sources_url_key" ON "admission_sources"("url");
CREATE INDEX "admission_sources_university_slug_status_idx" ON "admission_sources"("university_slug", "status");

CREATE TABLE "admission_facts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "university_slug" TEXT NOT NULL,
    "university_name" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "exam_code" TEXT NOT NULL,
    "cycle_year" INTEGER NOT NULL,
    "programme" TEXT,
    "label" TEXT NOT NULL,
    "value_text" TEXT,
    "value_number" REAL,
    "basis" TEXT,
    "category" TEXT,
    "round" TEXT,
    "event_date" TEXT,
    "source_page" INTEGER,
    "source_locator" TEXT,
    "checked_on" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_by" TEXT NOT NULL,
    "published_by" TEXT,
    "published_at" DATETIME,
    "reject_reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "admission_facts_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "admission_sources" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "admission_facts_university_slug_status_idx" ON "admission_facts"("university_slug", "status");
CREATE INDEX "admission_facts_source_id_idx" ON "admission_facts"("source_id");
