-- Official NTA documents (question papers, answer keys) that CUET Prep hosts in its own storage, with everything needed to show where
-- each file came from and that it was checked. One row per distinct file (the SHA-256 is unique, so a file can never be stored twice);
-- the document it belongs to is in `pyq_documents`. Additive: nothing existing is changed or removed.
CREATE TABLE "pyq_hosted_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "document_id" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "pages" INTEGER,
    "r2_key" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "alternate_urls_json" TEXT NOT NULL DEFAULT '[]',
    "retrieved_at" DATETIME NOT NULL,
    "http_status" INTEGER,
    "last_modified" TEXT,
    "verification" TEXT NOT NULL,
    "verification_notes_json" TEXT NOT NULL DEFAULT '[]',
    "printed_subject" TEXT,
    "printed_code" TEXT,
    "printed_medium" TEXT,
    "first_page_excerpt" TEXT,
    "rights_status" TEXT NOT NULL,
    "rights_basis" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "pyq_hosted_files_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "pyq_documents" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "pyq_hosted_files_sha256_key" ON "pyq_hosted_files"("sha256");
CREATE UNIQUE INDEX "pyq_hosted_files_document_id_key" ON "pyq_hosted_files"("document_id");
CREATE INDEX "pyq_hosted_files_verification_idx" ON "pyq_hosted_files"("verification", "rights_status");
