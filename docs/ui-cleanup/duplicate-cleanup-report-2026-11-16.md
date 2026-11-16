# Duplicate UI removal – report (16 Nov 2026)

Audit (written first): `duplicate-audit-2026-11-16.md`. Screenshots of the result (desktop 1440, tablet 820, phone 390): `after-2026-11-16/` (Today, Home, Profile, My Learning menu, account menu). No "before" screenshots were taken for this pass; the "before" state is the audit table.

## Removed (7 duplicates)
1. Header bookmark icon – My Bookmarks stays in the My Learning menu.
2. Account menu › Practice Centre – "Practice" stays in the header and the phone bar.
3. Account menu › Government updates – the page `/updates` stays, reached from the Today panel.
4. Account menu › Weekly report – stays on the Progress page.
5. Account menu › Official exam information – stays on the Home card.
6. Today: "Weekly report" header button – stays on the Progress page.
7. Today: "Subjects" table and "Full progress" link – Progress › By subject stays (the Overall accuracy card still links there).
Also on Home: the goal meter and "Open Today" side card, and the "Open today's plan" fallback card, were removed (they repeated Today). The unfinished-test / continue-learning link stays.

## Changed so nothing becomes unreachable
The "Latest government updates" panel on Today used to disappear when there were no notices. It now always shows (with "No new official updates right now.") so the link "All updates" is always there.

## Fixed on the way
Profile on a phone: a long subject name widened the subject list past the screen (sideways scroll). The chooser can now shrink (`min-w-0`).

## Primary locations (after)
My Bookmarks, Highlights and Notes, Revision Cards, Study Planner, Learning Progress, Today → My Learning menu. Practice Centre → "Practice". Weekly report → Progress. Government updates → Today panel → `/updates`. Official exam information → Home. University admissions, Plans and payments, Profile → account menu. Search → header icon. Notifications → bell.

## Kept on purpose
Weak topics (Today, Progress, weekly report), saved-cards-due card, today's plan, daily-goal meters (Today shows them, Profile changes them), the upgrade prompt, the `/cuet` information pages, admin tabs and their section shortcuts.

## Files modified
`frontend/src/Layout.tsx`, `frontend/src/pages/Dashboard.tsx`, `frontend/src/pages/Home.tsx`, `frontend/src/pages/Updates.tsx`, `frontend/src/pages/Profile.tsx`. New: `backend/scripts/ui-browser-check.mjs`, this report, the audit and screenshots. No route, API, permission or database change.

## Tests
Frontend typecheck clean; production build ok; frontend unit tests 7/7; full `npm run check` (see the final message for counts). Browser check on a throwaway database copy, three sizes: **88 of 88 checks pass** – removed items are gone, the Weekly report and Government updates pages open from their one remaining entry, the My Learning menu lists 6 distinct entries, the account menu holds only account items, 15 retained routes open at each size, no sideways scroll, no script errors. Not covered: the admin console and review screens (unchanged), and sign-in as a staff account.
