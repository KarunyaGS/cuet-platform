-- Version-aware, reviewer-verified mappings from official past-paper questions to that year's syllabus.
-- Existing question_topics links are intentionally left unchanged; they are not treated as evidence.
CREATE TABLE paper_topic_mappings (
  id TEXT PRIMARY KEY NOT NULL,
  past_paper_question_id TEXT NOT NULL,
  syllabus_version_id TEXT NOT NULL,
  curriculum_node_id TEXT,
  status TEXT NOT NULL DEFAULT 'UNMAPPED' CHECK (status IN ('UNMAPPED','SUGGESTED','VERIFIED','UNRESOLVED','REJECTED')),
  confidence TEXT CHECK (confidence IN ('HIGH','MEDIUM','LOW')),
  method TEXT NOT NULL DEFAULT 'MANUAL' CHECK (method IN ('MANUAL','AI_ASSISTED')),
  evidence_note TEXT,
  verified_by TEXT,
  verified_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (past_paper_question_id) REFERENCES past_paper_questions(id) ON DELETE CASCADE,
  FOREIGN KEY (syllabus_version_id) REFERENCES syllabus_versions(id) ON DELETE RESTRICT,
  FOREIGN KEY (curriculum_node_id) REFERENCES curriculum_nodes(id) ON DELETE RESTRICT,
  UNIQUE (past_paper_question_id, syllabus_version_id)
);

CREATE INDEX paper_topic_mappings_version_status_idx ON paper_topic_mappings(syllabus_version_id, status);
CREATE INDEX paper_topic_mappings_node_status_idx ON paper_topic_mappings(curriculum_node_id, status);

-- Append-only reviewer trail. A correction creates a new event; the current mapping row is just the latest state.
CREATE TABLE paper_topic_mapping_events (
  id TEXT PRIMARY KEY NOT NULL,
  mapping_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('SUGGEST','VERIFY','MARK_UNRESOLVED','REJECT','REVISE')),
  previous_json TEXT,
  next_json TEXT NOT NULL,
  note TEXT,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (mapping_id) REFERENCES paper_topic_mappings(id) ON DELETE CASCADE
);

CREATE INDEX paper_topic_mapping_events_mapping_created_idx ON paper_topic_mapping_events(mapping_id, created_at);
