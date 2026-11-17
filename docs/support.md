# Help and support

**Date:** 17 November 2026. Local development; not deployed.

Students can chat with the support team, raise tickets and follow them, from a floating button on every page. Nothing in it is simulated: no automatic replies, no invented status, no availability claim. A message is answered by a person in the admin console.

## What existed before

An audit of the code found no support, ticket or chat feature anywhere (backend, database or screens). What could be reused:

| Need | Reused |
|---|---|
| Student identity | `studentAuth` (the session cookie); every support route reads `c.get('user').id` |
| Staff access | The admin console API (`/api/console`), which signs staff in with their own account and checks a permission |
| File storage | The R2 `MEDIA` bucket |
| Abuse limits | `rateLimit` (D1-backed) |
| Migrations | `database/migrations`, Prisma schema kept in step |

## Database (migration `0036_support.sql`)

- `support_threads`: one row per conversation. `kind` is `CHAT` (one per student, enforced by a unique index) or `TICKET` (with `ticket_no`, unique `reference` such as `PRP-1001`, `category`, `title`). `status` is `OPEN`, `IN_PROGRESS` or `RESOLVED`.
- `support_messages`: the messages of a thread. `sender` is `STUDENT` or `STAFF`; an optional attachment (key, name, type, size).

## Student API (`/api/student/support`, signed in)

| Route | Does |
|---|---|
| `GET /chat`, `POST /chat/messages` | The student's one chat: history; send a message |
| `GET /tickets`, `POST /tickets` | The student's tickets; raise one (category, title, description, optional attachment) |
| `GET /tickets/:id`, `POST /tickets/:id/messages` | One ticket with its conversation; reply (a reply to a resolved ticket reopens it) |
| `POST /attachments` | Upload one attachment (raw body, `x-filename`) |
| `GET /attachments/:messageId` | Download an attachment of the student's own thread |
| `GET /unread` | How many replies the student has not seen (badge on the button) |

Rules enforced on the server:

- Every thread query includes the signed-in student's id, so another student's thread id answers "not found".
- Attachments: PNG, JPG, WebP or PDF only, up to 3 MB, and the first bytes must match the declared type. They are stored under `support/<student id>/` and a message can only name a file from its own sender's folder.
- Served with `no-store`, `nosniff` and a locked-down content security policy.
- Rate limits: messages, tickets and uploads are limited per student.
- The student sees only their own words and "Support" for staff replies; staff names and ids are never exposed.

## Staff API (`/api/console/support`, console sign-in with the `users:manage` permission)

`GET /threads` (filter by status, kind, search), `GET /threads/:id` (with the student's name and email, visible to staff only), `POST /threads/:id/messages` (reply; moves an open ticket to In progress), `PUT /threads/:id/status`, `GET /attachments/:messageId`. The page is **Admin console, Support**.

## Student interface

A round blue button at the bottom right of every page (hidden only on exam screens, where nothing may cover the test). It opens a compact panel: **Chat**, **Raise a ticket**, **My requests**. Drafts (the chat message and the ticket form) are kept while the panel is closed and across pages. Signed-out visitors are asked to sign in, because a conversation belongs to an account.

## What is not claimed

- No "Online" or "Away" status and no reply-time promise: there is no availability data. The chat says only that replies appear in the conversation.
- Staff replies are text only. Students can attach files; staff cannot yet.
- No email or push notification when staff reply; the button shows a badge for unseen replies and the panel refreshes while it is open.
