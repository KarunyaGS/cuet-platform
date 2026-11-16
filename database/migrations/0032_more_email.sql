-- More email, all opt-in. A student may enter the day of their own exam (never taken from us), and may switch on a daily
-- revision-cards reminder separately from the study-plan reminder. Nothing is sent until the student switches it on.
ALTER TABLE "student_preferences" ADD COLUMN "email_revision" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "student_preferences" ADD COLUMN "exam_date" TEXT;
