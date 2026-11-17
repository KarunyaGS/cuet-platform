-- Help and support: one chat conversation per student, and support tickets. Each is a "thread" of messages.
-- Every thread belongs to one student (user_id); the API only ever reads threads for the signed-in student.

CREATE TABLE "support_threads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ticket_no" INTEGER,
    "reference" TEXT,
    "category" TEXT,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    "last_message_at" TEXT NOT NULL,
    "last_staff_reply_at" TEXT,
    "student_seen_at" TEXT,
    CONSTRAINT "support_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- A ticket has a unique reference; a student has at most one chat thread.
CREATE UNIQUE INDEX "support_threads_reference_key" ON "support_threads"("reference") WHERE "reference" IS NOT NULL;
CREATE UNIQUE INDEX "support_threads_ticket_no_key" ON "support_threads"("ticket_no") WHERE "ticket_no" IS NOT NULL;
CREATE UNIQUE INDEX "support_threads_one_chat_per_student" ON "support_threads"("user_id") WHERE "kind" = 'CHAT';
CREATE INDEX "support_threads_user_id_kind_last_message_at_idx" ON "support_threads"("user_id", "kind", "last_message_at");
CREATE INDEX "support_threads_status_last_message_at_idx" ON "support_threads"("status", "last_message_at");

CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "thread_id" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "sender_user_id" TEXT,
    "body" TEXT NOT NULL,
    "attachment_key" TEXT,
    "attachment_name" TEXT,
    "attachment_mime" TEXT,
    "attachment_bytes" INTEGER,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "support_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "support_threads" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "support_messages_thread_id_created_at_idx" ON "support_messages"("thread_id", "created_at");
