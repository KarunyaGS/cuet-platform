-- Reference data that every environment needs. Facts only, each traceable to an official source.
-- Idempotent: INSERT OR IGNORE, so re-running never overwrites edited rows.

-- Exams
INSERT OR IGNORE INTO exams (id, code, name, level, created_at, updated_at) VALUES
  ('exam_cuet_ug', 'CUET_UG', 'Common University Entrance Test (UG)', 'UG', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exam_cuet_pg', 'CUET_PG', 'Common University Entrance Test (PG)', 'PG', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 2026 cycles. Rules from the NTA Information Bulletins:
-- UG: https://cdnbbsr.s3waas.gov.in/s3d1a21da7bca4abff8b0b61b87597de73/uploads/2026/01/202601031633478370.pdf
-- PG: https://cdnbbsr.s3waas.gov.in/s388a839f2f6f1427879fc33ee4acf4f66/uploads/2025/12/202512161583029269.pdf
INSERT OR IGNORE INTO exam_cycles (id, exam_id, year, label, status, rules_json, created_at, updated_at) VALUES
  ('cycle_cuet_ug_2026', 'exam_cuet_ug', 2026, 'CUET-UG 2026', 'ACTIVE',
   '{"maxPapersPerCandidate":5,"questionsPerPaper":50,"allQuestionsCompulsory":true,"durationMinutes":60,"marksCorrect":5,"marksIncorrect":-1,"marksUnattempted":0,"mode":"CBT","papersOffered":37,"mediumNote":"English plus the chosen language (13 offered); English prevails on dispute","source":"https://cdnbbsr.s3waas.gov.in/s3d1a21da7bca4abff8b0b61b87597de73/uploads/2026/01/202601031633478370.pdf"}',
   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cycle_cuet_pg_2026', 'exam_cuet_pg', 2026, 'CUET-PG 2026', 'ACTIVE',
   '{"maxPapersPerCandidate":4,"questionsPerPaper":75,"durationMinutes":90,"marksCorrect":4,"marksIncorrect":-1,"marksUnattempted":0,"mode":"CBT","papersOffered":157,"mediumNote":"English and Hindi except languages, M.Tech/Higher Sciences (English only) and most Acharya papers","source":"https://cdnbbsr.s3waas.gov.in/s388a839f2f6f1427879fc33ee4acf4f66/uploads/2025/12/202512161583029269.pdf"}',
   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- UG sections and PG paper families
INSERT OR IGNORE INTO subject_categories (id, exam_id, code, name, created_at, updated_at) VALUES
  ('cat_ug_language', 'exam_cuet_ug', 'LANGUAGE', 'Section I - Languages', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_ug_domain', 'exam_cuet_ug', 'DOMAIN', 'Section II - Domain-specific subjects', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_ug_gat', 'exam_cuet_ug', 'GAT', 'Section III - General Aptitude Test', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_pg_coqp', 'exam_cuet_pg', 'COQP', 'Common (COQP)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_pg_huqp', 'exam_cuet_pg', 'HUQP', 'Humanities (HUQP)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_pg_laqp', 'exam_cuet_pg', 'LAQP', 'Languages (LAQP)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_pg_scqp', 'exam_cuet_pg', 'SCQP', 'Sciences (SCQP)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_pg_mtqp', 'exam_cuet_pg', 'MTQP', 'M.Tech / Higher Sciences (MTQP)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_pg_acqp', 'exam_cuet_pg', 'ACQP', 'Acharya (ACQP)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- What we may do with material, by source licence
INSERT OR IGNORE INTO usage_permissions
  (id, code, name, licence_url, allows_commercial_use, allows_adaptation, requires_attribution, share_alike, public_display, notes, created_at, updated_at) VALUES
  ('perm_nta_reference', 'NTA_OFFICIAL_REFERENCE', 'NTA official document (reference; cite and link)', NULL, NULL, NULL, 1, NULL, 0,
   'No licence stated by NTA. Use the syllabus structure as facts with a link to the official PDF. Do not republish the PDF.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_owned', 'OWNED_ORIGINAL', 'Original content we own (work-for-hire / authored)', NULL, 1, 1, 0, 0, 1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_demo', 'DEMONSTRATION_ONLY', 'Demonstration record (not real curriculum content)', NULL, 0, 1, 0, 0, 0,
   'Created only to show how the system works. Never publish to students.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_cc_by_4', 'CC_BY_4_0', 'Creative Commons Attribution 4.0', 'https://creativecommons.org/licenses/by/4.0/', 1, 1, 1, 0, 1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_cc_by_sa_4', 'CC_BY_SA_4_0', 'Creative Commons Attribution-ShareAlike 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/', 1, 1, 1, 1, 1,
   'Adaptations must be shared under the same licence.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_cc_by_nc_nd_4', 'CC_BY_NC_ND_4_0', 'Creative Commons Attribution-NonCommercial-NoDerivatives 4.0', 'https://creativecommons.org/licenses/by-nc-nd/4.0/', 0, 0, 1, NULL, 0,
   'DIKSHA states NCERT textbooks use this licence. Reference only in a paid product.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_unknown', 'UNKNOWN', 'Licence not yet established', NULL, NULL, NULL, 1, NULL, 0,
   'Treat as all rights reserved until checked.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Roles and permissions (B2C product: no teacher or school roles)
INSERT OR IGNORE INTO roles (id, code, name, created_at) VALUES
  ('role_super_admin', 'SUPER_ADMIN', 'Super administrator', CURRENT_TIMESTAMP),
  ('role_content_admin', 'CONTENT_ADMIN', 'Content administrator', CURRENT_TIMESTAMP),
  ('role_reviewer', 'REVIEWER', 'Subject-expert reviewer', CURRENT_TIMESTAMP),
  ('role_editor', 'EDITOR', 'Content editor', CURRENT_TIMESTAMP),
  ('role_student', 'STUDENT', 'Student', CURRENT_TIMESTAMP),
  ('role_parent', 'PARENT', 'Parent', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO permissions (id, code, description, created_at) VALUES
  ('perm_curriculum_read', 'curriculum:read', 'Read curriculum and syllabus versions', CURRENT_TIMESTAMP),
  ('perm_curriculum_write', 'curriculum:write', 'Create and edit curriculum nodes and papers', CURRENT_TIMESTAMP),
  ('perm_content_write', 'content:write', 'Create and edit learning resources, media and questions', CURRENT_TIMESTAMP),
  ('perm_content_review', 'content:review', 'Verify, request changes or reject content', CURRENT_TIMESTAMP),
  ('perm_content_publish', 'content:publish', 'Approve and publish content', CURRENT_TIMESTAMP),
  ('perm_answers_read', 'answers:read', 'Read answer keys', CURRENT_TIMESTAMP),
  ('perm_sources_write', 'sources:write', 'Register source documents and upload files', CURRENT_TIMESTAMP),
  ('perm_imports_run', 'imports:run', 'Run syllabus imports', CURRENT_TIMESTAMP),
  ('perm_users_manage', 'users:manage', 'Manage users and roles', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 'role_super_admin', id FROM permissions;
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('role_content_admin', 'perm_curriculum_read'), ('role_content_admin', 'perm_curriculum_write'),
  ('role_content_admin', 'perm_content_write'), ('role_content_admin', 'perm_content_publish'),
  ('role_content_admin', 'perm_answers_read'), ('role_content_admin', 'perm_sources_write'),
  ('role_content_admin', 'perm_imports_run'),
  ('role_reviewer', 'perm_curriculum_read'), ('role_reviewer', 'perm_content_review'), ('role_reviewer', 'perm_answers_read'),
  ('role_editor', 'perm_curriculum_read'), ('role_editor', 'perm_content_write'), ('role_editor', 'perm_answers_read');
