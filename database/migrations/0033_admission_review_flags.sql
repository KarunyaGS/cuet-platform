-- A draft admission fact can carry a flag: something about it that still has to be checked against the official documents
-- (for example, two documents that disagree). A flagged fact cannot be published until a person says how it was resolved.
ALTER TABLE "admission_facts" ADD COLUMN "review_flag" TEXT;
