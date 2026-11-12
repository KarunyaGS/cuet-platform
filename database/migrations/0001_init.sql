-- CreateTable
CREATE TABLE "exams" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "exam_cycles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exam_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "rules_json" TEXT,
    "source_document_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "exam_cycles_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "exam_cycles_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "source_documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "subject_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exam_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "subject_categories_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exam_id" TEXT NOT NULL,
    "category_id" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "subjects_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "subjects_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "subject_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "test_papers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exam_cycle_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "question_count" INTEGER,
    "duration_minutes" INTEGER,
    "marks_correct" INTEGER,
    "marks_incorrect" INTEGER,
    "medium_note" TEXT,
    "official_syllabus_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "test_papers_exam_cycle_id_fkey" FOREIGN KEY ("exam_cycle_id") REFERENCES "exam_cycles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "test_papers_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "syllabus_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "test_paper_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "source_document_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "is_demonstration" BOOLEAN NOT NULL DEFAULT false,
    "extracted_at" DATETIME,
    "published_at" DATETIME,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "syllabus_versions_test_paper_id_fkey" FOREIGN KEY ("test_paper_id") REFERENCES "test_papers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "syllabus_versions_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "source_documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "curriculum_nodes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "syllabus_version_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "kind" TEXT NOT NULL,
    "label" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "position" INTEGER NOT NULL,
    "depth" INTEGER NOT NULL,
    "source_page" INTEGER,
    "extraction_flags" TEXT,
    "content_hash" TEXT NOT NULL,
    "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "curriculum_nodes_syllabus_version_id_fkey" FOREIGN KEY ("syllabus_version_id") REFERENCES "syllabus_versions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "curriculum_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "curriculum_nodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "curriculum_relations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "from_node_id" TEXT NOT NULL,
    "to_node_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "curriculum_relations_from_node_id_fkey" FOREIGN KEY ("from_node_id") REFERENCES "curriculum_nodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "curriculum_relations_to_node_id_fkey" FOREIGN KEY ("to_node_id") REFERENCES "curriculum_nodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "usage_permissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "licence_url" TEXT,
    "allows_commercial_use" BOOLEAN,
    "allows_adaptation" BOOLEAN,
    "requires_attribution" BOOLEAN NOT NULL DEFAULT true,
    "share_alike" BOOLEAN,
    "public_display" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "source_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "listed_on_url" TEXT,
    "retrieved_at" DATETIME NOT NULL,
    "sha256" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "page_count" INTEGER,
    "r2_key" TEXT,
    "usage_permission_id" TEXT NOT NULL,
    "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "source_documents_usage_permission_id_fkey" FOREIGN KEY ("usage_permission_id") REFERENCES "usage_permissions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "source_references" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_document_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "page" INTEGER,
    "locator" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "source_references_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "source_documents" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "learning_resources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "curriculum_node_id" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "origin" TEXT NOT NULL,
    "usage_permission_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "is_demonstration" BOOLEAN NOT NULL DEFAULT false,
    "content_hash" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "learning_resources_curriculum_node_id_fkey" FOREIGN KEY ("curriculum_node_id") REFERENCES "curriculum_nodes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "learning_resources_usage_permission_id_fkey" FOREIGN KEY ("usage_permission_id") REFERENCES "usage_permissions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "content_blocks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resource_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "media_asset_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "content_blocks_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "learning_resources" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "content_blocks_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "r2_key" TEXT,
    "external_url" TEXT,
    "mime_type" TEXT NOT NULL,
    "byte_size" INTEGER,
    "sha256" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "duration_seconds" INTEGER,
    "alt_text" TEXT NOT NULL,
    "caption" TEXT,
    "long_description" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "attribution" TEXT,
    "usage_permission_id" TEXT NOT NULL,
    "source_document_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "media_assets_usage_permission_id_fkey" FOREIGN KEY ("usage_permission_id") REFERENCES "usage_permissions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "media_assets_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "source_documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "diagram_labels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "media_asset_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "diagram_labels_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "passages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "origin" TEXT NOT NULL,
    "usage_permission_id" TEXT NOT NULL,
    "source_document_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "content_hash" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "passages_usage_permission_id_fkey" FOREIGN KEY ("usage_permission_id") REFERENCES "usage_permissions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "passages_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "source_documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "stem" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "translation_group_id" TEXT,
    "passage_id" TEXT,
    "difficulty" TEXT NOT NULL,
    "learning_objective" TEXT,
    "structure_json" TEXT,
    "origin" TEXT NOT NULL,
    "usage_permission_id" TEXT NOT NULL,
    "source_document_id" TEXT,
    "source_locator" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "is_demonstration" BOOLEAN NOT NULL DEFAULT false,
    "content_hash" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "questions_passage_id_fkey" FOREIGN KEY ("passage_id") REFERENCES "passages" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "questions_usage_permission_id_fkey" FOREIGN KEY ("usage_permission_id") REFERENCES "usage_permissions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "questions_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "source_documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "media_asset_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "question_options_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "answer_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question_id" TEXT NOT NULL,
    "correct_option_positions" TEXT,
    "numeric_answer" REAL,
    "numeric_tolerance" REAL,
    "verified_by" TEXT,
    "verified_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "answer_keys_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "explanations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question_id" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "body" TEXT NOT NULL,
    "option_rationale_json" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "explanations_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "question_tags" (
    "question_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    PRIMARY KEY ("question_id", "tag_id"),
    CONSTRAINT "question_tags_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "question_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "question_topics" (
    "question_id" TEXT NOT NULL,
    "curriculum_node_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("question_id", "curriculum_node_id"),
    CONSTRAINT "question_topics_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "question_topics_curriculum_node_id_fkey" FOREIGN KEY ("curriculum_node_id") REFERENCES "curriculum_nodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "question_media" (
    "question_id" TEXT NOT NULL,
    "media_asset_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("question_id", "media_asset_id", "role"),
    CONSTRAINT "question_media_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "question_media_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "review_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "actor" TEXT NOT NULL,
    "comment" TEXT,
    "checklist_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "import_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "idempotency_key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source_document_id" TEXT,
    "status" TEXT NOT NULL,
    "stats_json" TEXT,
    "errors_json" TEXT,
    "actor" TEXT NOT NULL,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" DATETIME,
    CONSTRAINT "import_runs_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "source_documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "detail_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,

    PRIMARY KEY ("user_id", "role_id"),
    CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    PRIMARY KEY ("role_id", "permission_id"),
    CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "exams_code_key" ON "exams"("code");

-- CreateIndex
CREATE UNIQUE INDEX "exam_cycles_exam_id_year_key" ON "exam_cycles"("exam_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "subject_categories_exam_id_code_key" ON "subject_categories"("exam_id", "code");

-- CreateIndex
CREATE INDEX "subjects_category_id_idx" ON "subjects"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_exam_id_slug_key" ON "subjects"("exam_id", "slug");

-- CreateIndex
CREATE INDEX "test_papers_subject_id_idx" ON "test_papers"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_papers_exam_cycle_id_code_key" ON "test_papers"("exam_cycle_id", "code");

-- CreateIndex
CREATE INDEX "syllabus_versions_source_document_id_idx" ON "syllabus_versions"("source_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "syllabus_versions_test_paper_id_version_number_key" ON "syllabus_versions"("test_paper_id", "version_number");

-- CreateIndex
CREATE INDEX "curriculum_nodes_syllabus_version_id_parent_id_position_idx" ON "curriculum_nodes"("syllabus_version_id", "parent_id", "position");

-- CreateIndex
CREATE INDEX "curriculum_nodes_syllabus_version_id_verification_idx" ON "curriculum_nodes"("syllabus_version_id", "verification");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_nodes_syllabus_version_id_content_hash_key" ON "curriculum_nodes"("syllabus_version_id", "content_hash");

-- CreateIndex
CREATE INDEX "curriculum_relations_to_node_id_idx" ON "curriculum_relations"("to_node_id");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_relations_from_node_id_to_node_id_type_key" ON "curriculum_relations"("from_node_id", "to_node_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "usage_permissions_code_key" ON "usage_permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "source_documents_sha256_key" ON "source_documents"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "source_documents_r2_key_key" ON "source_documents"("r2_key");

-- CreateIndex
CREATE INDEX "source_documents_kind_idx" ON "source_documents"("kind");

-- CreateIndex
CREATE INDEX "source_documents_url_idx" ON "source_documents"("url");

-- CreateIndex
CREATE INDEX "source_references_entity_type_entity_id_idx" ON "source_references"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "source_references_source_document_id_entity_type_entity_id_page_key" ON "source_references"("source_document_id", "entity_type", "entity_id", "page");

-- CreateIndex
CREATE UNIQUE INDEX "learning_resources_content_hash_key" ON "learning_resources"("content_hash");

-- CreateIndex
CREATE INDEX "learning_resources_curriculum_node_id_idx" ON "learning_resources"("curriculum_node_id");

-- CreateIndex
CREATE INDEX "learning_resources_status_language_idx" ON "learning_resources"("status", "language");

-- CreateIndex
CREATE INDEX "content_blocks_media_asset_id_idx" ON "content_blocks"("media_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_blocks_resource_id_position_key" ON "content_blocks"("resource_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_r2_key_key" ON "media_assets"("r2_key");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_sha256_key" ON "media_assets"("sha256");

-- CreateIndex
CREATE INDEX "media_assets_kind_status_idx" ON "media_assets"("kind", "status");

-- CreateIndex
CREATE INDEX "diagram_labels_media_asset_id_idx" ON "diagram_labels"("media_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "passages_content_hash_key" ON "passages"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "questions_content_hash_key" ON "questions"("content_hash");

-- CreateIndex
CREATE INDEX "questions_status_type_idx" ON "questions"("status", "type");

-- CreateIndex
CREATE INDEX "questions_translation_group_id_idx" ON "questions"("translation_group_id");

-- CreateIndex
CREATE INDEX "questions_passage_id_idx" ON "questions"("passage_id");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_question_id_position_key" ON "question_options"("question_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "answer_keys_question_id_key" ON "answer_keys"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "explanations_question_id_language_key" ON "explanations"("question_id", "language");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "question_tags_tag_id_idx" ON "question_tags"("tag_id");

-- CreateIndex
CREATE INDEX "question_topics_curriculum_node_id_idx" ON "question_topics"("curriculum_node_id");

-- CreateIndex
CREATE INDEX "question_media_media_asset_id_idx" ON "question_media"("media_asset_id");

-- CreateIndex
CREATE INDEX "review_records_entity_type_entity_id_created_at_idx" ON "review_records"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "review_records_actor_created_at_idx" ON "review_records"("actor", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "import_runs_idempotency_key_key" ON "import_runs"("idempotency_key");

-- CreateIndex
CREATE INDEX "import_runs_source_document_id_idx" ON "import_runs"("source_document_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_created_at_idx" ON "audit_logs"("actor", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");
