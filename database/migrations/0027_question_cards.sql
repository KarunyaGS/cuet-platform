-- Revision cards from attempted practice questions. Additive only.
-- A question card is a row in the same flashcards table, so it shares the schedule, the review history and My bookmarks.
-- It holds a reference to the question and NO copy of it: the question, answer and explanation are read from the question
-- tables each time, so a corrected question is corrected on every card.
ALTER TABLE "flashcards" ADD COLUMN "question_id" TEXT REFERENCES "questions" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One card per student per question (rows without a question, the lesson cards, are not affected: NULLs never collide).
CREATE UNIQUE INDEX "flashcards_user_id_question_id_key" ON "flashcards"("user_id", "question_id");
CREATE INDEX "flashcards_question_id_idx" ON "flashcards"("question_id");
