# Admissions information

**Built 16 November 2026 (local only; nothing deployed).** This implements the first phase of `docs/admissions-design.md` in a smaller form: a register of official sources, and facts that each cite an approved source. No admissions fact has been entered or published. Students see nothing from this until a member of staff approves a source and publishes a fact.

## The rules

1. **No source, no fact.** A fact (a dated step, eligibility as printed, or a cut-off) must cite a source a member of staff has **approved** after opening its page, the page or place it came from, and the day it was checked.
2. **A person publishes.** A fact starts as a draft. Staff with `content:publish` publish or reject it. It is shown only while its source stays approved: retiring a source hides every fact that cites it.
3. **Cut-offs carry their basis.** Every cut-off says what the number is (allocation score, normalised score, percentile, marks, rank), its category, its round or list and its programme. Figures on different bases are never put side by side. A percentile must be 0 to 100, a rank a whole number, a score 0 to 2000.
4. **Text is stored as printed.** Eligibility is a quotation. Nothing is rewritten, worked out or predicted.
5. **No personal data.** There is no column for a name or a roll number, and text that looks like a roll or application number, a long number, an email address, a phone number or a candidate's name is refused. Lists of candidates (merit, allotment, selection, hostel) are linked to, never stored.
6. **No reuse of documents.** Only the facts are kept, with a link to the university's own page. No PDF is copied or hosted.

## Source register

Nine sources from the 16 November 2026 review are held as **proposed**; load them from Admin, Admissions ("Load the reviewed sources"). Each carries the review's recommendation, the format, how often it seems to change, whether it links to candidate lists, and notes on what was and was not checked.

| Source | Recommendation | Main caution |
| --- | --- | --- |
| NTA, CUET (UG) participating universities | Use | The page gives type links only; sub-pages not opened |
| NTA, CUET (PG) site | Not verified | The server refused automated reading (403) |
| University of Delhi, admission.uod.ac.in | Use with care | Facts are in PDFs; merit and tentative lists may name candidates |
| Banaras Hindu University, admission.bhu.ac.in | Use with care | Programme table only; allotment lists carry names |
| JNU, jnuee.jnu.ac.in | Use with care | Mixes old and new items; merit lists are on other portals |
| University of Hyderabad, acad.uohyd.ac.in | Use with care | A hub with no dates; read the linked pages |
| Jamia Millia Islamia, admission.jmi.ac.in | Not verified | Two reads returned nothing; lists name candidates |
| University of Allahabad, allduniv.ac.in/admission | Use with care | Admission pages not opened; lists name students |
| AMU, amucontrollerexams.com | Do not use | Not an ac.in domain; links to a roll list elsewhere. Approving it needs a written reason |

The review was made by reading the pages with a web reader, so it is second-hand. A person must open each page before approving it.

## Where it shows

- Staff: Admin, **Admissions**: sources (approve after opening, retire), add a fact, facts (publish, reject). Approving a source records the person and the day.
- Students: `/universities/:slug`, linked from the participating-universities list for universities that have an approved page or a published fact. It shows the official pages, then dates, eligibility and cut-offs, each with its source, page and the day it was checked, and tells the student to confirm on the official page. A university with nothing published says so plainly.

## API

| Route | Who | Purpose |
| --- | --- | --- |
| `GET /api/public/admissions/universities/:slug` | everyone | The page's data |
| `GET /api/public/universities` | everyone | Now returns each university's `slug` and `hasAdmissionInfo` |
| `GET /api/console/admissions/overview`, `/sources`, `/facts` | staff | Monitoring and lists |
| `POST /api/console/admissions/sources`, `/sources/load-reviewed` | `content:write` | Propose sources |
| `POST /api/console/admissions/sources/:id/decision` | `content:publish` | Approve (needs the day checked) or retire |
| `POST /api/console/admissions/facts`, `/facts/import?dryRun=1` | `content:write` | Add a fact; import a pack all or nothing, as drafts |
| `POST /api/console/admissions/facts/:id/decision` | `content:publish` | Publish or reject |

Tables (migration 0029): `admission_sources`, `admission_facts`. The existing `participating_universities` list (NTA's own) supplies the university names; no university table was added.

## Not built

University course finder, eligibility checker, programme rules by CUET paper, admission timeline pages, automatic reading of university PDFs, and any prediction of a student's chances. Reading cut-off PDFs would need the extraction pipeline and a second independent read before a figure is trusted; it is a later step and needs the source list approved first.
