# Duplicate-feature audit – written before the cleanup (16 Nov 2026)

Method: read every navigation component and every student page's links and sections (`Layout.tsx`, `Home`, `Dashboard`, `Profile`, `Progress`, `Report`, `Planner`, `Bookmarks`, `Plans`, `PracticeCentre`, `Pyq`, `Updates`, `Subject`, `Topic`, `Learn`, `Subjects`, `Search`, `Results`, the `/cuet` information pages, the admin and review navigation), and the route table in `main.tsx`. Routes, permissions and APIs are not touched by any decision below.

| # | Feature | Where it appears today | Canonical place (kept) | Redundant copies (removed) |
|---|---|---|---|---|
| 1 | My bookmarks | My Learning menu › My Bookmarks; header bookmark icon (desktop and phone) | My Learning menu | Header bookmark icon |
| 2 | Practice Centre | Header "Practice" (desktop) and bottom-bar "Practice" (phone); account-menu "Practice Centre" | Header / bottom-bar "Practice" | Account-menu item |
| 3 | Government updates | Account menu; Dashboard "Latest government updates" panel (hidden when there are none); the page `/updates` | The page `/updates`, reached from the Today panel ("All updates"). The panel now always shows, so the page can always be reached | Account-menu item |
| 4 | Weekly report | Account menu; Dashboard header button; Progress header button; link inside the report back to Progress | Progress page button (the report is part of progress) | Account-menu item; Dashboard header button |
| 5 | Official exam information (`/cuet`) | Home card; account menu; sign-in/sign-up page links; Search empty-state button | Home card (and the public links on sign-in pages, which are for visitors) | Account-menu item |
| 6 | Subject-by-subject progress | Dashboard "Subjects" table with "Full progress"; Progress "By subject" | Progress page | Dashboard "Subjects" section |
| 7 | Resume / last topic / questions-today meter | Home "Continue" card (with goal meter and "Open Today" link); Dashboard "Continue learning", goal meters and unfinished tests | Today (dashboard) | Home: the goal meter and its "Open Today" link, and the "Open today's plan" fallback card. The one-line "Unfinished test" / "Continue where you left off" link stays on Home |
| 8 | Daily goals | Dashboard meters (read-only, with a note); Profile "Daily goals" (where they are changed) | Both are different (view vs setting) | none |
| 9 | Weak topics | Dashboard; Progress; Weekly report (that week only) | Kept in all three: Dashboard is today's to-do (with Revise), Progress is the full list, the report is one week | none (different purpose and period) |
| 10 | Saved cards due | Dashboard "Saved cards due today"; My Learning › Revision Cards; Bookmarks page | Kept: the Dashboard card is the due count with one action | none |
| 11 | Study plan | Dashboard "Today's plan"; Planner page | Kept: today's slice versus the full planner | none |
| 12 | Official previous-year papers | Practice Centre (official section, PYQ browser, link to `/past-papers`); `/pyq` and `/past-papers` pages | Practice Centre (the pages are its drill-downs and are only reached from it) | none (no second entry exists) |
| 13 | University admissions | Account menu only; links from university and programme pages | Account menu | none |
| 14 | Plans and payments | Account menu; upgrade prompt when a limit is reached | Account menu (the prompt is contextual) | none |
| 15 | Search | Header icon only | Header icon | none |
| 16 | Notifications | Reminders bell only | Bell | none |
| 17 | Admin console tabs | One tab bar; overview "Manage / By subject / All activity" links inside sections | Tab bar (section links are contextual shortcuts to a tab that does exist once) | none |
| 18 | Profile | Account, Exam and subjects, Daily goals, Email, Password | Already personal/account only; nothing duplicated from other pages | none |

Not changed because the copies are different things: `/cuet` notices (NTA information notices) versus `/updates` (government and NTA/UGC notice monitor); Dashboard accuracy card (links to Progress, not a table).
