# Security notes

- **Admin API (local development)**: a shared token in `x-admin-token`, kept in `backend/.dev.vars`
  (git-ignored) and compared in constant time. Production needs real staff sign-in (for example
  Cloudflare Access in front of `/api/admin/*`) and per-role permissions from the `roles` tables.
- **Answer keys**: separate table; public routes return only published, non-demonstration questions and
  never include keys before an attempt.
- **No external AI at runtime**: the Worker has no AI binding and no AI SDK dependency. Answers come from
  `answer_keys` and `explanations`.
- **Secrets**: never committed. `.dev.vars`, `.env` and Wrangler state are git-ignored. The D1
  `database_id` is not a secret; the Cloudflare account id and API tokens are never written to the repo.
- **Uploads**: type allow-list, size cap, PDF signature check, content-addressed keys.
- **Source licences**: official NTA documents are stored privately for reference and cited by link;
  they are not republished. NCERT textbooks (DIKSHA: CC BY-NC-ND) are reference only.
