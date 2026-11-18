# Question counts: what each number means

**Checked 18 November 2026 against the local database and the live preview's read-only API.** Run `node backend/scripts/question-counts.mjs` to reproduce every number below (read-only; it prints the same table for any subject code you give it).

## The unique counts

| Subject | Unique questions | Verified | Not verified | Topics tagged per question | Question text repeated |
|---|---|---|---|---|---|
| Physics (322) | **1,000** | 787 (786 through the bulk management approval, 1 individually) | 213 | exactly 1 | 1 pair (a match-the-following with the same opening line; the options differ) |
| Chemistry (306) | **600** | 0 | 600 | exactly 1 | 2 groups (3 and 2 questions with the same opening line) |

Every question belongs to exactly one syllabus topic (`question_topics` has 1,000 rows for 1,000 Physics questions and 600 for 600 Chemistry questions), so nothing is counted twice. A question appearing in a practice paper or a chapter question-bank PDF is **not** a second question: those documents reuse bank questions (Physics: 11 PDFs list 1,100 entries for 1,000 questions; Chemistry: 12 PDFs list 700 entries for 600 questions, because practice sets 1 and 2 repeat 100 questions that also sit in the chapter banks).

## Why other numbers appeared

| Number seen | What it was |
|---|---|
| 787 (Physics) | The questions inside the 31 **lesson packs** (`content/packs/CUET_UG/322/ug26-322-*.json`). 23 question-only packs (`zz-more-*.json`) later added 213 more, making 1,000. The 787 also happens to be the number verified by the bulk approval, because the 213 came later and are not verified. Earlier documents (`practice-centre-plan.md`, `preview-environment.md`) were written when 787 was the whole bank |
| 200 (Chemistry) | The questions inside the 10 **lesson packs** (20 each). 20 question-only packs (`zz-more-*.json`) added 400 more (10 x 40), making 600 (10 x 60) |
| 60 per Chemistry card | Correct: 10 chapters x 60 |
| "about 900" (Physics cards) | Not reproduced: the nine chapter cards add up to 1,000 (154 + 75 + 180 + 99 + 92 + 164 + 69 + 76 + 91). If the chapter cards and the topic cards inside them are added together, the questions are counted twice (about 2,000), so any total under 1,000 must come from a view that hides some questions, or from an older build. Send the screen and I will trace it |

## How the screens count

| Where | What is counted |
|---|---|
| Subject list (`/api/learn/exams/.../subjects`), "N questions" | All questions of the subject that students may see |
| Chapter (unit) card | Questions tagged to the chapter or **anything inside it** (the whole subtree), without repeats (`COUNT(DISTINCT)` in `topicDetail`) |
| Topic card inside a chapter | Questions tagged to that topic only |
| Outline (`paperOutline`) | Questions tagged **directly** to each node, so a chapter that only contains topics shows 0 there and its topics show their own counts |

"Students may see" means: not a demonstration question, not rejected or marked needing changes, and either published, or, while the content preview is on, any status except archived. The preview Worker has the content preview on.

Because every question has exactly one topic, the chapter cards add up to the unique total, and so do the topic cards. Both views are correct; they must not be added to each other.

## What was not changed

No question was deleted, merged or rewritten to make a total match. The repeated opening lines above are reported, not removed: the questions differ in their options and answers.
