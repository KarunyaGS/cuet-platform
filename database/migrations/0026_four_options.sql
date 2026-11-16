-- A CUET choice question has four options, positions 1 to 4, labelled A to D.
-- These guards apply only to options that are inserted, or whose position or label is changed, after this migration.
-- Existing rows are not read, rewritten or rejected, so older data keeps working exactly as before.
CREATE TRIGGER "question_options_four_options_insert"
BEFORE INSERT ON "question_options"
WHEN NEW."position" NOT BETWEEN 1 AND 4 OR NEW."label" != substr('ABCD', NEW."position", 1)
BEGIN
  SELECT RAISE(ABORT, 'question_options: a CUET question has four options, positions 1 to 4, labelled A to D');
END;

CREATE TRIGGER "question_options_four_options_update"
BEFORE UPDATE OF "position", "label" ON "question_options"
WHEN NEW."position" NOT BETWEEN 1 AND 4 OR NEW."label" != substr('ABCD', NEW."position", 1)
BEGIN
  SELECT RAISE(ABORT, 'question_options: a CUET question has four options, positions 1 to 4, labelled A to D');
END;
