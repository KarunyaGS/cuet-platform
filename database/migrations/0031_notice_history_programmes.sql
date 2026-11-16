-- Priority 1: notice version history and audit trail, revisions and corrigenda, and programme-level admissions information. Additive only.

-- ---------------------------------------------------------------- notices
ALTER TABLE "gov_notices" ADD COLUMN "version_count" INTEGER NOT NULL DEFAULT 1;
-- The earlier notice that this one corrects or replaces, and how (CORRIGENDUM, ADDENDUM, REVISED, EXTENSION, RESCHEDULED, AMENDMENT).
ALTER TABLE "gov_notices" ADD COLUMN "revision_of_id" TEXT;
ALTER TABLE "gov_notices" ADD COLUMN "revision_kind" TEXT;
-- The checks that made this notice's source count as official, in words.
ALTER TABLE "gov_notices" ADD COLUMN "authenticity_note" TEXT;
CREATE INDEX "gov_notices_revision_of_id_idx" ON "gov_notices"("revision_of_id");

-- Every version of a notice as the official page showed it (a changed title or date, or a replaced document).
CREATE TABLE "gov_notice_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notice_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "published_on" TEXT,
    "document_url" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detected_at" DATETIME NOT NULL,
    CONSTRAINT "gov_notice_versions_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "gov_notices" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "gov_notice_versions_notice_id_version_key" ON "gov_notice_versions"("notice_id", "version");

-- Everything that happened to a notice: found, published on its own, queued, changed at the source, and every decision by staff.
CREATE TABLE "gov_notice_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notice_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gov_notice_events_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "gov_notices" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "gov_notice_events_notice_id_created_at_idx" ON "gov_notice_events"("notice_id", "created_at");

-- Version 1 of every notice already held, so history starts complete.
INSERT INTO "gov_notice_versions" ("id", "notice_id", "version", "title", "description", "published_on", "document_url", "content_hash", "reason", "detected_at")
SELECT 'gnv_' || lower(hex(randomblob(12))), "id", 1, "title", "description", "published_on", "document_url", "content_hash", 'First detected', "first_detected_at" FROM "gov_notices";
INSERT INTO "gov_notice_events" ("id", "notice_id", "action", "actor", "from_status", "to_status", "note", "created_at")
SELECT 'gne_' || lower(hex(randomblob(12))), "id", 'DETECTED', 'system:notice-reader', NULL, "verification_status", "status_note", "first_detected_at" FROM "gov_notices";

-- ---------------------------------------------------------------- admissions: programmes
-- One undergraduate (or postgraduate) programme at one university for one admission year, taken from an approved source.
CREATE TABLE "admission_programmes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "university_slug" TEXT NOT NULL,
    "university_name" TEXT NOT NULL,
    "university_type" TEXT,
    "programme_name" TEXT NOT NULL,
    "degree" TEXT,
    "level" TEXT NOT NULL DEFAULT 'UG',
    "academic_year" TEXT NOT NULL,
    "exam_code" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_page" INTEGER,
    "source_locator" TEXT,
    "last_verified_on" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_by" TEXT NOT NULL,
    "published_by" TEXT,
    "published_at" DATETIME,
    "status_note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "admission_programmes_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "admission_sources" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "admission_programmes_unique_key" ON "admission_programmes"("university_slug", "programme_name", "academic_year", "exam_code");
CREATE INDEX "admission_programmes_status_type_idx" ON "admission_programmes"("status", "university_type");

-- A fact can belong to a programme, and a required-CUET-subjects fact carries its subjects as a list.
ALTER TABLE "admission_facts" ADD COLUMN "programme_id" TEXT;
ALTER TABLE "admission_facts" ADD COLUMN "subjects_json" TEXT;
CREATE INDEX "admission_facts_programme_id_idx" ON "admission_facts"("programme_id");
