-- Marking scheme kept with every attempt, and a way to record a wrong or dropped question.
-- NTA rule (CUET-UG Information Bulletin): if a question is found wrong or is dropped, everyone who appeared gets the full marks for it.

ALTER TABLE "answer_keys" ADD COLUMN "key_status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "practice_sessions" ADD COLUMN "scheme_json" TEXT;
ALTER TABLE "practice_sessions" ADD COLUMN "credited_count" INTEGER NOT NULL DEFAULT 0;
