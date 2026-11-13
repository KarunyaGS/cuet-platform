# Navigation, layout and spacing cleanup (13 November 2026)

Local build only. Screenshots: `docs/ui-cleanup/before/` and `docs/ui-cleanup/after/`.

## Navigation

Header: logo, **Home**, **Learn** (CUET UG, CUET PG), **Practice**, **My Learning** (Today, My Bookmarks, Highlights and Notes, Revision Cards, Study Planner, Learning Progress), then search, notifications, bookmark and the profile menu.

- Every menu item opens a page that already existed. No page was added or removed.
- The header marks the group the current page belongs to (`navGroup` in `frontend/src/Layout.tsx`).
- Menus close on a choice, on Escape and on a tap outside; items can be reached with the arrow keys.
- Phone: the bottom bar is Home, Learn, Practice, My Learning. The two menus open as a sheet above the bar.
- Government updates stays in the profile menu; its header icon was removed.
- My bookmarks now takes its tab from the address (`?tab=notes`, `?tab=pages`, `?tab=recent`), so menu links can open a given tab.

## Layout rules (shared)

| Rule | Value | Where |
|---|---|---|
| Page container | `max-w-[84rem]`, gutters 16 / 24 / 32 px | `Layout.tsx` (header and main) |
| Space under the header | 20 px | `Layout.tsx` |
| Page title block | 20 px below; title up to 60rem wide | `PageHeader` in `ui.tsx` |
| Between sections | 28 px (`mb-7`); smaller groups 24 px | pages |
| Reading text | 50rem at most, centred with its side column | lesson, notes |
| Single-column pages | centred in the container | updates, search, profile, plans |
| Two columns | content + a 20 to 22rem side column from 1024 px up; stacked below | topic, lesson |

## Pages changed

- **Topic:** breadcrumb, then title with its actions on one row, then content left and a side panel right (Practise, Quick revision, Saved for revision). Stacks on tablet and phone.
- **Saved for revision block:** heading on one line, figures and the button on the next. This was the overlapping text: the row squeezed its heading under its neighbours in a narrow column.
- **Lesson:** title first, text at a readable width, saved cards and "On this page" in one sticky side column.
- **Quick revision:** full width, notes in two columns on a wide screen (a note never splits), compact header and filter.
- **Dashboard, home, subjects, progress, updates, practice centre, results:** section gaps reduced to the shared rule.

## Checks

- Layout measurement over 34 page views (13 pages at 1440 px; 7 pages at 1280, 820 and 390 px): 0 faults (sideways scroll, anything outside its card, overlapping rows, text over text). Content uses about 85% of a 1440 px window, up from 73%.
- Navigation and layout browser check: 35 of 35.
- The overlap detector was written during this work; the old overlap was confirmed by eye in the "before" screenshot, not by re-running the detector on the old build.
