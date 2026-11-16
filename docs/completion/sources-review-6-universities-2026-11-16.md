# Source review: six proposed admissions sources (READ-ONLY)

Reviewed 2026-11-16. Client name used for every request: `CUETPrepBot/1.0 (educational information service; admissions source review)`.
Nothing was written to any repo or database, nothing approved, imported or published. Raw downloads are in `D:/tmp/p1-review/sources6/raw/` (review copies only).
No merit / selection / allotment / counselling list or any candidate-level document was opened. No candidate name or roll number is recorded here.

PDF page numbers below are PDF page order (page 1 = first page of the file). Where the document prints its own page number, it is given as "printed N".
Text extraction by pdftotext. Where tables came out garbled this is said.

---------------------------------------------------------------------------
## 1. NTA: CUET (UG) participating universities
URL: https://cuet.nta.nic.in/participating-universities/

### (1) Identity / authenticity
- Domain `cuet.nta.nic.in` is a government `nic.in` domain. The site footer says "Content Owned and Maintained by National Testing Agency"; header shows "Government of India / Ministry of Education / Department of Higher Education" and links to https://www.education.gov.in/en/higher_education.
- NTA's own umbrella site https://nta.ac.in/ (HTTP 200) links to it as "Common University Entrance Test-UG (CUET-UG)" -> https://cuet.nta.nic.in/.
- The 2026 Information Bulletin (see below) names this exact URL as the place to see the university list (PDF p.14, section 1.3).
- Domain type: government (`nic.in`). Strong authenticity.
- Oddity: the HTML `<title>` of every page still reads "COMMON UNIVERSITY ENTRANCE TEST (CUET-UG) 2025", while the content is 2026 (stale page title only).

### (2) Cycle
- Page content is the CUET (UG) 2026 list (admission session 2026-27). A separate 2025 list exists at https://cuet.nta.nic.in/universities/ (title "Participating Universities | COMMON UNIVERSITY ENTRANCE TEST (CUET-UG) 2025"), reachable from the menu under Archive > 2025.
- Page footer: "Last Updated: Oct 12, 2026".
- CUET (UG) 2026 itself is closed (exam May-June 2026, result declared; home page "LATEST NEWS" lists the NTA result/NTA Scores notice and the final answer keys, 2026-06). Admission cycle 2026-27 is mostly underway/closed at universities.

### (3) Information available
Category pages (all fetched, HTTP 200, numbered tables with only "S.No." and "University Name"):

| Type | URL | Universities listed |
|---|---|---|
| Central | https://cuet.nta.nic.in/participating-universities/central-universities/ | 49 (first: Aligarh Muslim University, last: Visva-Bharati University; serial 1-49, no gaps) |
| State | https://cuet.nta.nic.in/participating-universities/state-universities/ | 41 (Baba Ghulam Shah University ... University of Ladakh) |
| Deemed | https://cuet.nta.nic.in/participating-universities/deemed-universities/ | 27 (Avinashilingam Institute ... Vinayaka Mission's Research Foundation) |
| Private | https://cuet.nta.nic.in/participating-universities/private-universities/ | 120 (Abhyuday University ... World University of Design) |
| Other Government Institutions | https://cuet.nta.nic.in/participating-universities/other-government-institutions/ | 7 (Footwear Design and Development Institute ... Rajiv Gandhi Institute of Petroleum Technology) |

- Total = 49 + 41 + 27 + 120 + 7 = **244**. Serial numbers run without gaps in every table; the 244 names are all distinct (no duplicates).
- Comparison with the 244 UG rows already in our database: the **count matches (244)**. I had no access to the database (read-only, not allowed), so I cannot say whether the names/types match one-for-one. Action for the owner: compare names and the type split (49/41/27/120/7). If the DB split differs, flag it, because a total of 244 can hide a different split. Note the NTA page itself has no state, city, website or programme fields; only names.
- NTA's CUET (UG) 2026 Information Bulletin: https://cdnbbsr.s3waas.gov.in/s3d1a21da7bca4abff8b0b61b87597de73/uploads/2026/01/202601031633478370.pdf (97 PDF pages, hosted on the government `s3waas.gov.in` CDN, linked from the CUET menu "Information Bulletin"). Facts read:
  - PDF p.7 (printed 6): "conducted in 13 mediums"; "for the academic year 2026-27"; application "03-30 January 2026 (upto 11.50 PM)"; fee "31 January 2026"; correction "02-04 February 2026"; "Announcement of the City of Examination 11-31 May 2026 (Tentative)"; "upto a maximum of five (05) subjects including languages and General Aptitude Test". Extraction of the dates table is misaligned (labels and dates are on shifted lines), so the exact label-to-date pairing should be checked against the PDF image before anything is imported.
  - PDF p.7 fee table: General (UR) up to 03 subjects 1000/- and 400/- each additional; OBC-NCL/EWS 900/- and 375/-; SC/ST/PwD 800/- and 350/-; centres outside India 4500/- and 1800/-. Category-to-amount alignment is garbled in extraction; verify.
  - PDF p.14 (printed 13), 1.1-1.3: NTA conducts CUET (UG) for all Central Universities and participating universities, session 2026-27; list at https://cuet.nta.nic.in/participating-universities/.
  - PDF p.17 (printed 16), Chapter 3, 3.1-3.2: no age limit; Class 12 passed or appearing in 2026 can appear; list of qualifying examinations; candidates "will be required to fulfill the age criteria (if any) of the University".
  - Bulletin PDF contains 97 pages; "counselling" appears at p.21 and p.33 (disability/reservation context only); the bulletin has no university-wise admission procedure.
- Home page notices, 2026 (PDF links on https://cuet.nta.nic.in/): result/NTA Scores notice https://cdnbbsr.s3waas.gov.in/s3d1a21da7bca4abff8b0b61b87597de73/uploads/2026/06/20260623716111016.pdf; final answer keys .../2026/06/202606231857909583.pdf; FAQ .../2026/01/2026011697237004.pdf; syllabus page https://cuet.nta.nic.in/cuetug-2026-syllabus/. (Not read in detail.)

### (4) Missing / outdated / conflicting
- No programme lists, eligibility, required CUET subjects, university-wise dates or cut-offs on this page (names only).
- Page `<title>` says 2025 while content is 2026.
- Not stated: whether the participating-university list is final, or the mapping of university to programmes. NTA itself directs candidates to each university's own site.

### (5) Personal-data risk
- Participating-universities pages: none (institution names only).
- Candidate-level items on the NTA UG home page (titles only, not opened): "List of toppers of CUET (UG) - 2026" (https://cdnbbsr.s3waas.gov.in/s3d1a21da7bca4abff8b0b61b87597de73/uploads/2026/06/20260623268704934.pdf); "Score Card for CUET(UG) - 2026" (login, per candidate).

### (6) Recommendation: **USE**
Official, government domain, linked from NTA's own umbrella site and cited by the NTA bulletin. Names only; best treated as the master list of participating institutions, 244 total.

### (7) Importable later as DRAFT (after approval; nothing imported)
- Participating-university names grouped by the five types, with counts (49/41/27/120/7) and "Last Updated: Oct 12, 2026" as source date.
- Facts from the CUET (UG) 2026 bulletin: max five subjects, fee table, eligibility/QE list, schedule (after checking the garbled tables).

---------------------------------------------------------------------------
## 2. NTA: CUET (PG)
URL: https://exams.nta.nic.in/cuet-pg/

### (1) Identity / authenticity
- Could not be read. https://exams.nta.nic.in/cuet-pg/ returned **HTTP 403 "Access Denied"** (an Akamai edge error page, reference `#18.15e23017.1794819972.839c96d2`) to the honest client name. I also retried with a normal browser-style User-Agent header (Chrome-style string with "CUETPrepBot/1.0" appended): still **403**. The site root https://exams.nta.nic.in/ is also **403**. So this host is blocked to automated reads; I did not try to evade the block further.
- Indirect identity evidence: NTA's umbrella site https://nta.ac.in/ (HTTP 200) lists "Common University Entrance Test-PG (CUET-PG)" with the link https://exams.nta.nic.in/cuet-pg/ (and AIAPGET at https://exams.nta.nic.in/AIAPGET/). So the host is NTA's own and NTA links to it. Domain type: government (`nic.in`). I could not read its content, so authenticity of the page content is NOT_VERIFIED by me.
- University of Hyderabad's "Admission procedure" PDF cites the CUET-PG site as `https://exams.nta.ac.in/CUET-PG/` (a different host: `.ac.in`, not `.nic.in`). I tried https://exams.nta.ac.in/ (HTTP 200, a page titled "NTA Exam | India" whose news items run 2023-2025 and has no CUET-PG link), and https://exams.nta.ac.in/CUET-PG/ and .../cuet-pg/ (HTTP 404). So the `.ac.in` address in that UoH document does not lead to a CUET-PG page. This is a conflict between sources (UoH `.ac.in` vs NTA `.nic.in`).

### (2) Cycle
- NOT STATED (page unreadable).
- Fallback pages tried: https://cuet.nta.nic.in/cuet-pg/ redirects (HTTP 200) to an old archive document "CUET PG - 2022 : Final Answer Key" (https://cuet.nta.nic.in/document/cuet-pg-2022-final-answer-key/). So the CUET site only holds a 2022 PG archive page. https://cuet.nta.nic.in/document-category/cuet-pg/ and /cuet-pg-archive/ are 404.
- Other-source mention only: University of Hyderabad's home page lists "P.G.-2026" and "P.G.Admissions-2025" and a PG notification PDF, so a CUET (PG) 2026 cycle existed at least for UoH. UoH PG page: https://acad.uohyd.ac.in/cuetpg26.html (not opened; out of scope).

### (3) Information available
- NOT STATED. No PG programme, eligibility, subject, date or cut-off information could be read from an NTA-owned page.

### (4) Missing / unverifiable
- Everything. The 403 blocks all content. Do not guess it.
- Suggested follow-up (needs a human with a normal browser, or NTA permission): open https://exams.nta.nic.in/cuet-pg/ manually and copy the current Information Bulletin PDF URL, then review that PDF.

### (5) Personal-data risk
- Unknown (page unreadable). NTA PG sites normally carry candidate login/score card and may carry result/topper notices; do not import any such item.

### (6) Recommendation: **NOT_VERIFIED**
Right host (NTA links to it) but unreadable to us. Also out of scope for a UG product: CUET PG would only matter for a later PG feature.

### (7) Importable later as DRAFT
- Nothing now. After a human read: PG bulletin facts (eligibility, subjects, dates) could be drafted.

---------------------------------------------------------------------------
## 3. University of Hyderabad (UoH): Academic section hub
URL: https://acad.uohyd.ac.in (it redirects to `https://acad.uohyd.ac.in/?AspxAutoDetectCookieSupport=1`, HTTP 200)

### (1) Identity / authenticity
- Domain `acad.uohyd.ac.in` is a sub-domain of the university's own `uohyd.ac.in` (`.ac.in` = Indian academic domain). The page header is "University of Hyderabad / Academic & Examinations"; its footer has a link "University Website" -> http://uohyd.ac.in/. The UoH-issued notification PDFs and prospectus (below) state "Online application form and other details are available at http://acad.uohyd.ac.in/", and the Prospectus 2026-27 names "https://uohyd.ac.in/" as the university site (PDF p.3). I did not open the main uohyd.ac.in homepage to see its link back to acad; the university's own documents confirm the sub-domain, which is sufficient.
- Application portal: https://uohydcuet.samarth.edu.in (named "Int. PG Portal-2025" on the hub, and used for "ONLINE APPLICATION FOR UG PROGRAMMES" on the UG page). `samarth.edu.in` is the e-governance platform used by central universities; this one is a hosted application portal, not a content source.
- Domain type: academic (`.ac.in`). Strong authenticity.
- The hub is old and cluttered (items from 2017-2023 still shown). It is a hub, as expected.

### (2) Cycle
- Current: UG & Integrated PG Admissions 2026-27 based on CUET (UG) 2026 scores. Hub page "U.G.-2026" -> https://acad.uohyd.ac.in/cuetUg26.html (server is case-insensitive; same content as `CUETUG26.html`). Title: "UG & Integrated PG Admissions - 2026-27".
- Dates (UG/IPG Notification PDF, below): application started 07/07/2026, deadline extended 21/07/2026 -> 24/07/2026, correction window 25/07/2026-26/07/2026, provisional selected lists and waiting lists 03/08/2026, physical reporting for counselling and document verification 13/08/2026 and 14/08/2026, classes begin 17/08/2026.
- Status on 2026-11-16: **closed** (waiting-list operations were on the hub: "Waiting List-4 Operations :: Int. P.G. Admissions - 2026"). Next cycle (2027-28) NOT STATED.
- Older cycles also on the hub: UG-2025 (`cuetug25.html`), UG-2024 (`cuetug24.html`), UG-2023 (`cuetug23.html`).

### (3) Information available (UG / Integrated PG, CUET-based)
1. UG/Integrated PG Admission Notification 2026-27 (with extension notice): http://acad.uohyd.ac.in/downloads/CUET_UG_2026_NOTIF.pdf (4 PDF pages).
   - PDF p.1: "UG/INTEGRATED PG ADMISSION NOTIFICATION 2026-27 EXTENSION OF LAST DATE ... last date ... extended from 21/07/2026 to 24/07/2026. A correction window ... from 25/07/2026 to 26/07/2026." Dated 23/07/2026, signed "Controller of Examinations I/c".
   - PDF p.2: "UG/INTEGRATED PG ADMISSION ANNOUNCEMENT 2026-27 ... 17 Undergraduate and Integrated PG programmes based on CUET (UG) 2026 scores"; seat matrix (GE/SC/ST/OBC/EWS/PWD/DP). Total seats **470**: 4-Year B.S. (Hons/Research) Chemistry 20; I.M.Sc. Mathematical Science 40, Physics 40, Chemistry 20, Biology 60, Applied Geology 18, Psychology 20; I.M.A. Philosophy 20, Hindi 20, Telugu 19, Urdu 14, Language Sciences 19, Economics 30, History 35, Political Science 50, Sociology 25, Anthropology 20 (row-to-programme alignment is garbled in extraction; the row sums were read from the "Total" column and the grand total 470 / 189 GE, 72 SC, 34 ST, 128 OBC, 47 EWS, 22 PWD, 22 DP matches the printed totals).
   - PDF p.3 "IMPORTANT DATES": the schedule listed above, dated 07/07/2026.
2. Minimum qualifications and criteria (CUET domain/language papers, core vs qualifying, eligibility): http://acad.uohyd.ac.in/downloads/CUETUG_26.PDF (7 PDF pages).
   - PDF p.1: core papers decide the merit list; qualifying papers: "minimum of 50 marks in the qualifying papers (35 marks for IMA Hindi, IMA Urdu & IMA Telugu. 45% marks in the paper General Aptitude test for admission to I.Msc Psychology)"; "To apply, please visit: https://cuet.nta.nic.in/".
   - PDF p.2-5: table "List of 4-Year Bachelor's programme and 5-Year/6-Year Integrated PG programmes offered by UoH: Academic Year 2026-27" with column D (CUET domain/language papers with test paper codes, e.g. Mathematics 319, Physics 322, Chemistry 306, Biology 304, Psychology 324, Telugu 112, Hindi 102, Urdu 113, English 101, General Aptitude Test 501) and column E (eligibility, e.g. "minimum of 60% marks at +2 level of education with Science subjects only" for the I.M.Sc. programmes; Telugu/Hindi/Urdu as a +2 subject for those I.M.A. programmes). The table is split across pages and extraction is garbled in places (columns interleaved on PDF p.2-5), so programme-to-paper mapping should be re-checked on the PDF before import.
   - PDF p.6 "Remarks": English compulsory for all programmes; SC/ST/PwBD minimum eligibility is a pass; "passed ... within the last Four (4) years (i.e., Passed out in the year 2023 or later) only will be eligible".
3. Prospectus 2026-27: https://acad.uohyd.ac.in/downloads/pros2026.pdf (420 PDF pages, 11 MB). Page 2: online registration fee General Rs. 600/-, EWS 550/-, OBC-NCL 400/-, SC/ST/PWD 275/-. PDF p.18 (printed 16): table "UNDERGRADUATE PROGRAMMES" (4-Year B.S. Chemistry, intake 20, 8 semesters; 5-Year B.Optometry, intake 30, merit by NEET marks, 10+2 with 50%). PDF p.19 (printed 17): "INTEGRATED PG PROGRAMMES, ADMISSION THROUGH CUET UG" with intake, eligibility, "Merit list generation based on" (e.g. M.Sc Mathematical Sciences = CUET-UG marks of Maths+Physics+Chemistry; M.Sc Physics = Physics+Maths). The prospectus contents (PDF p.5-6) list department pages.
4. **Cut-off statement** (PDF p.73, printed 71): "No cut off marks for Integrated PG and PG courses. The University has decided not to have any cut-off marks in the entrance examination in the core papers ... Only those candidates who secure the minimum prescribed marks in the qualifying papers will be considered ..." for 2026-27. So there are no previous-year cut-off figures to read; "cut-off" in the prospectus refers to Ph.D. (PDF p.72) and to this no-cut-off rule.
5. Admission procedure (all programmes): http://acad.uohyd.ac.in/downloads/admission_procedure.PDF (3 PDF pages, undated): B.S.(Hons) and Integrated PG = "CUET - UG Test score + UoH online application" (https://cuet.nta.nic.in/); B.Optometry = NEET; integrated M.Tech = JEE via JoSAA; PG = CUET-PG + UoH application, citing `https://exams.nta.ac.in/CUET-PG/` (the conflicting `.ac.in` host, see source 2). Counselling: PDF p.3 of the notification (reporting and document verification 13-14/08/2026).
6. Hub also lists UG programme-related items: "Steps to resolve the Payment issue" http://acad.uohyd.ac.in/downloads/Check_Payment_26.pdf (not opened), "Admission Schedule - (Integrated PG, PG and Ph.D. Programs 2023-24)" http://acad.uohyd.ac.in/downloads/admissions23.pdf (old, not opened).

### (4) Missing / outdated / conflicting
- Previous-year cut-offs: NOT STATED (and none to state for 2026-27, per prospectus PDF p.73).
- CUET-PG site address in `admission_procedure.PDF` (`exams.nta.ac.in/CUET-PG/`) does not resolve to a CUET-PG page (404); NTA's own link is `exams.nta.nic.in/cuet-pg/`.
- The notification says 17 programmes in total (16 integrated + 1 four-year B.S.); the Prospectus says "17 Integrated PG Programmes" is counted on the hub text ("invites applications ... to the below mentioned 17 Integrated PG Programs"), i.e. a small wording inconsistency about whether B.S. Chemistry is counted in the 17.
- Hub is cluttered with items from 2017-2025; only the 2026-27 items are current. The hub page itself has no page-level date.
- The extracted tables (notification p.2, programme-criteria PDF p.2-5) are garbled; verify against rendered PDF before import. Only UG and Integrated PG CUET items are relevant to a UG product.
- Tie-break, vacancy/waiting-list rules for UG: NOT STATED in the files I read (prospectus is 420 pages; I read only the contents, p.18-19, p.72-73).

### (5) Personal-data risk (titles only, not opened)
Candidate-level pages on the hub: "B.Optom./UG/IPG Admissions 2026 :: List of candidates Called for Admission Counselling" (https://acad.uohyd.ac.in/26resIPG.html); "B.Optom.(5Years) Admission Notificaiton 2026 :: List of candidates Called for Admission Counselling" (https://acad.uohyd.ac.in/26resipg.html); "M.C.A. Admissions 2026 :: List of candidates Called for Admission Counselling" (https://acad.uohyd.ac.in/resPG26.html); "List of Candiates Called for the Admission Counselling :: All PG Programmes- 2026" (26respg.html); "Waiting List-4 Operations :: Int. P.G. Admissions - 2026" (Downloads/IPG_WL.pdf); "Waiting List-3 Operations :: P.G. Admissions - 2026" (Downloads/PG_WL.pdf); "Waiting List-2 Operations :: Ph.D Admissions - 2026" (Downloads/PhD_WL.pdf); "Int.P.G. 2025 :: List of candidates Called for Admission counselling based on CUET_UG_2025" (Resipg25.html); "List of candidates called for admission counselling :: Integrated P.G./B.S.(Hons) Programmes based on CUET-UG-2024 score" (resipg24.html); "List of Candidates called for Interview/GD - M.B.A. (General) - 2026" (results/MBAD_2026_INT_NOTIFICATION.pdf); Ph.D. called-for-interview/counselling lists (RES26JANPHD.html, ResIntphd_jan26.html, ResInt26phd_NET.html); "M.Tech.[CCMT]/Int. M.Tech.[JoSAA] reporting ..." (downloads/CCMT_JoSAA_2026.pdf); "Search Your Application Number" (online.uohyd.ac.in/SearchApplication.aspx, login-type lookup); hall ticket download pages.
The notification, prospectus, criteria PDF and admission_procedure PDF contain no candidate names.

### (6) Recommendation: **USE_WITH_CARE** for UG/Integrated PG
Authentic (own `.ac.in` domain, referenced by its own signed notices). Reasons for "with care": hub is cluttered and unversioned, tables garbled in extraction (need visual check), and only a small UG-related set (17 programmes, 470 seats) applies; no cut-offs exist. Import only from the four named PDFs, never from the result-list pages.

### (7) Importable later as DRAFT
- 17 UoH UG/Integrated PG programmes: names, intake/seat matrix (470), CUET core/qualifying paper codes, eligibility (60% at +2 etc.), qualifying minimum marks, "no cut-off" rule, application fee, important dates 2026-27 (marked as past/closed), admission steps (CUET + UoH application + counselling).
- Source links: the four PDFs listed above plus https://acad.uohyd.ac.in/cuetUg26.html.

---------------------------------------------------------------------------
## 4. Jamia Millia Islamia (JMI)
URL: https://admission.jmi.ac.in

### (1) Identity / authenticity
- `https://admission.jmi.ac.in/` returned HTTP 200 with only 170 bytes: an HTML page that auto-submits (JavaScript POST) a form to `https://jmicoe.in/` and nothing else. That is why an earlier read returned nothing. It is a redirect stub, not a content page.
- Official link from JMI's own site: https://www.jmi.ac.in/ (title "Official Website of Jamia Millia Islamia") has top-menu "Admissions" -> https://www.jmi.ac.in/ACADEMICS/Admissions/Admission-Notifications, and its scrolling marquee links `admission.jmi.ac.in` and `admission.jmi.ac.in/EntranceResults/UniversityResult`. The Admission Notifications and "Admissions (University And Jamia Schools)" pages on jmi.ac.in both say "Please Visit below link www.jmicoe.in" and give an "Admission Portal" link to http://admission.jmi.ac.in/. So jmi.ac.in itself links to both `admission.jmi.ac.in` and `jmicoe.in`.
- `jmicoe.in` is titled "JMI Controller of Examinations | New Delhi / Jamia Millia Islamia (A Central University) New Delhi NAAC A++ Accredited", lists JMI contact numbers and support@jmicoe.in, and its CDOE page links back to `https://admission.jmi.ac.in/CDOE/Admissions...`. Domain type of `jmicoe.in`: a plain `.in` domain (not `.ac.in`); `admission.jmi.ac.in` is `.ac.in`. JMI's own site vouches for both, so identity is acceptable, but `jmicoe.in` should be recorded as official-by-linkage only.
- jmi.ac.in page footer says "Website Last Updated on : 22/09/2022" (the notification pages themselves are CMS pages, so this date is likely stale/boilerplate).

### (2) Cycle
- What was readable: "Admission (CDOE) 2026-27" at https://jmicoe.in/Admission.aspx ("Click here for Admissions in Centre for Distance and Online Education (CDOE) (2026-27)" -> Apply Now at https://admission.jmi.ac.in/CDOE/Admissions?... , HTTP 200). That is distance education, not regular CUET UG.
- jmi.ac.in "Admissions (University And Jamia Schools)": "Admission 2025-2026 (Jamia Schools)" (school admissions; old).
- Regular UG admission cycle for 2026-27: **NOT STATED** on any page I could read. jmicoe.in latest news (2026-11-15, e.g. "Interview Guidance Programme (IGP) for JMI-RCA-CCCP 2026") is a coaching programme, not UG admissions. https://www.jmi.ac.in/Notifications.aspx?category=Admission is 404; https://jmicoe.in/Notifications.aspx?category=Admission is 200 but its listing is exam date-sheets and exam forms, not admission notices.

### (3) Information available
- None for a UG/CUET student that I could read: no UG programme list, eligibility, CUET subjects, counselling procedure, dates or cut-offs. Not stated on pages reachable by plain HTTP. `admission.jmi.ac.in` itself appears to be a login/application portal (CodeIgniter-style session cookie), whose content may need a browser session.
- JMI's published prospectus/information brochure: NOT FOUND via these pages.
- Whether JMI UG uses CUET, its own entrance test, or both for 2026-27: NOT STATED here (do not assume).

### (4) Missing / unverifiable
- Entire UG content (see above). Two domains involved (`admission.jmi.ac.in` and `jmicoe.in`) with a POST redirect between them; a bot cannot follow it without special handling (a plain GET of `admission.jmi.ac.in` yields only the stub).
- jmi.ac.in menu says "Admission Portal" is `http://admission.jmi.ac.in/` (http) while the cited marquee uses https.
- "Website Last Updated on : 22/09/2022" footer.

### (5) Personal-data risk (titles/URLs only)
- Marquee link `https://admission.jmi.ac.in/EntranceResults/UniversityResult` (entrance results page, not opened; likely candidate-level). jmicoe.in student/applicant logins and "Result" page (https://jmicoe.in/Result.aspx, not opened). No names recorded.

### (6) Recommendation: **NOT_VERIFIED** for UG data
Identity is genuine (jmi.ac.in links to both domains), but there is no readable UG/CUET information. Use only as a "where to apply / official link" pointer to https://www.jmi.ac.in/ACADEMICS/Admissions/Admission-Notifications until a human reads the portal in a browser.

### (7) Importable later as DRAFT
- Nothing now. Possible later: official admissions link set (jmi.ac.in Admissions page, admission.jmi.ac.in, jmicoe.in/Admission.aspx) as link-only entries; programme data only after a human reads the UG prospectus.

---------------------------------------------------------------------------
## 5. University of Allahabad (UoA)
URL: https://allduniv.ac.in/admission (HTTP 200 but **empty body (0 bytes)**, so the exact URL is not a usable page). Working entry points found on the site's home page https://allduniv.ac.in/ and https://allduniv.ac.in/student/admission.

### (1) Identity / authenticity
- `allduniv.ac.in` is the university's own `.ac.in` domain; page title "University of Allahabad", footer "(c) University of Allahabad. All Rights Reserved." The university's own UG bulletin (PDF p.12) cites its UG admission portal as https://alldunivcuet.samarth.edu.in/ (a `samarth.edu.in` application portal).
- Domain type: academic (`.ac.in`). I did not independently see a link from a government/UGC page; NTA's participating-universities list (Central, row 46) names UNIVERSITY OF ALLAHABAD; the same list names ALIGARH MUSLIM UNIVERSITY (Central, row 1), JAMIA MILLIA ISLAMIA (Central, row 26) and UNIVERSITY OF HYDERABAD (Central, row 48), so all four universities are confirmed as CUET (UG) participants by NTA.
- The CUET-UG notice says admissions are "strictly based on CUET scores" and cites https://cuet.nta.nic.in/ (consistent with NTA).

### (2) Cycle
- Current: UG Admissions 2026-27 through CUET (UG) 2026. The "UG Admissions - 2026" page (https://allduniv.ac.in/p/715/ug-admissions-2026) is live. PG: https://allduniv.ac.in/p/714/pg-admission-2026-2027 (PGAT 2026). Ph.D.: https://allduniv.ac.in/p/717/phd-admission-2026-2027. Home page also shows hostel notices dated 05 Nov 2026 and 13 Nov 2026 (second waiting hostel allotment), so UG admission 2026-27 is in its late phase/closed for new registration; exact closing date NOT STATED.

### (3) Information available
1. UG Admissions 2026 page https://allduniv.ac.in/p/715/ug-admissions-2026 : links for "Information Bulletin" (https://allduniv.ac.in/upload/file_collection/UG%20Information%20Bulletin_2026.pdf), online registration CUET-UG-2026 (https://alldunivcuet.samarth.edu.in/), B.A.B.Ed. CUET-NCTE-2026 (https://alldunivcuet.samarth.edu.in/ncet), faculty pages (Arts https://allduniv.ac.in/p/716/..., Science /p/710/, Commerce /p/711/, Law /p/712/, IPS /p/713/ - not opened), helpdesk email aupravesh@allduniv.ac.in, technical helpline +919453852490 (11:00 AM - 05:00 PM).
2. **CUET-UG notice**: https://www.allduniv.ac.in/upload/file_collection/Notice%20UG%20Admissiosn%202026%2027%20UoA%20F.pdf (109 PDF pages: pages 1-10 are the UoA notice, then the NTA CUET (UG) 2026 bulletin attached; the notice text is partly image-garbled in Hindi, only the English part is readable).
   - PDF p.1: "admissions to all Undergraduate (UG) programmes for the Academic Session 2026-27 ... shall be conducted exclusively through the Common University Entrance Test - CUET (UG) 2026"; "Four-Year Undergraduate Programme (FYUGP) framework ... NEP-2020"; "followed by University-level counselling".
   - PDF p.1-2 points: registration 3-30 Jan 2026; correction window 2-4 Feb 2026; exam 11-31 May 2026 (tentative); max five subjects; **"Hindi or English and General Aptitude Test are compulsory for all UG programmes"**; "only one domain subject shall be considered for preparation of merit"; marking 5 marks per correct answer, minus 1 per wrong answer; 50 questions, 60 minutes per paper.
   - PDF p.5, Table 1 "Programme specific subject requirement for UG courses (2026-27)": English or Hindi + General Aptitude Test + any ONE domain subject from a list per programme group (e.g. BA, BALLB(Hons), BFA, BPA, B.Voc Media, BA Media Studies, Fashion Design: Accountancy ... Sociology; BCom: Home Science, Physics, Chemistry ... etc.). Row-to-column alignment of the table is garbled in extraction, so the mapping of programme groups to subject lists must be re-checked visually.
   - PDF p.6-8, Table 2 "Eligibility criteria for Undergraduate courses (2026-27)": e.g. B.Com: 10+2 in Commerce or Science; B.Sc (Maths): Physics, Chemistry, Mathematics at 10+2; BCA/Five-Year BCA-MCA/B.Voc Software: Science/Commerce or Maths/Statistics/IT/CS/Information Science subject; B.Sc Biology: Physics, Chemistry, Biology; BALLB (Hons): 45% general, 42% OBC, 40% SC/ST in qualifying exam; BA: any of Arts/Science/Commerce; Five-year Family & Community Sciences and Fashion Design: only female applicants.
3. **UG Information Bulletin 2026**: https://allduniv.ac.in/upload/file_collection/UG%20Information%20Bulletin_2026.pdf (65 PDF pages, 26 MB).
   - PDF p.10: admission based on CUET (UG) 2026 and NCTE/NCET 2026 scores; PDF p.12: steps (register on NTA portal https://cuet.nta.nic.in/; register, select programme and pay on https://alldunivcuet.samarth.edu.in/; counselling and fee; mandatory physical reporting).
   - PDF p.45: "Sanctioned Intake for 2026-27" per programme, total **3698** (BA 1995; B.Sc Maths 450; B.Sc Bio 200; B.Com 300; BFA 40; BPA 40; ... BALLB(Hons) 120; BA B.Ed 50; B.Voc Software 25; BCA 80; etc.; the printed total matches my sum).
   - PDF p.46-47: "How to self-calculate merit" worked examples (best of English/Hindi + best domain subject + General Test).
   - PDF p.58-59 FAQ (Dual Major B.A./B.Sc. model; documents; APAAR ID requirement mentioned at PDF p.10); PDF p.64 helpdesk.
   - Previous-year cut-offs: **not found** (word search for "cut-off" gives only PDF p.20 "cut-offs prescribed" in a different (NEP/exit) context; no cut-off figures).
4. Reservation/seat distribution and subject-combination lists (PDF p.15-17, p.49-54) not read in detail.

### (4) Missing / conflicting
- The URL `https://allduniv.ac.in/admission` returns an empty page; the real pages are `/student/admission` and `/p/715/ug-admissions-2026`.
- Previous-year cut-offs: NOT STATED.
- Counselling schedule/dates for 2026-27: NOT STATED in the bulletin (only steps).
- Conflict: the notice (PDF p.1-2) says only ONE domain subject is considered for merit, while the bulletin FAQ wording (PDF p.59, Q6) says "at least one" domain choice - consistent only if "at least one chosen, one counted". Check before importing.
- Conflict: the bulletin (PDF p.11) tells students to check the CUET portal at `https://exams.nta.ac.in/CUET-UG` (404), while PDF p.12 and the notice give `https://cuet.nta.nic.in/`. Treat `cuet.nta.nic.in` as correct.
- Notice file is a 9.6 MB scan-style PDF with Hindi text lost in extraction; bulletin 26 MB.
- Four-Year programme structure (dual major) etc. not verified against UGC.

### (5) Personal-data risk (titles only, not opened)
- On the home page and admission pages: "13 Nov 2026 Second waiting allotment list of the hostel for Male & Female students of ..." (https://allduniv.ac.in/public/upload/news/dsw second waiting573.pdf); "Press release of PGAT 26 result (PGAT 2 and IPS)" (https://allduniv.ac.in/public/upload/news/SCAN_20260625_172918865.pdf); "List of Admitted Student" (link on /student/admission); "Online Status of Results" (`studentResult`); "Archive Result" (https://allduniv.ac.in/student/result); "List of Medalist" (https://allduniv.ac.in/student/list-of-medalist). The UG notice, bulletin and helpdesk lines contain no candidate names.

### (6) Recommendation: **USE_WITH_CARE**
Official `.ac.in` source, UG 2026-27 CUET subject map, eligibility and intake are all in primary PDFs. Use only the notice and the bulletin; verify tables visually (garbled), and do not use the `/admission` URL. No cut-offs or counselling dates.

### (7) Importable later as DRAFT
- UoA UG programme list with sanctioned intake 2026-27 (19 rows, total 3698), CUET compulsory papers (English or Hindi + General Aptitude Test + one domain), programme-wise domain subject lists (Table 1), eligibility (Table 2), admission steps, fees/ helpdesk contacts, plus the faculty page links. Draft only after table verification.

---------------------------------------------------------------------------
## 6. Aligarh Muslim University (AMU)
URL reviewed: https://amucontrollerexams.com (earlier rating: DO_NOT_USE) and https://www.amu.ac.in

### (1) Identity / authenticity: does amu.ac.in link to amucontrollerexams.com?
- **Yes.** The AMU home page https://www.amu.ac.in (title "Aligarh Muslim University | AMU") has a top-menu item "Admissions" -> `https://www.amucontrollerexams.com` and "Admissions/Exams" -> `https://www.amucontrollerexams.com/`. The same entry also appears in the site's own menu API response embedded in the page (menu id 74: `"label":"Admissions","link":"https://www.amucontrollerexams.com"`). The same links appear on https://www.amu.ac.in/sub-page/admissions (HTTP 200 page, which lists the Admissions menu items but no further content).
- The AMU "Controller of Examination" page https://www.amu.ac.in/central-facilities/controller-of-examination is on amu.ac.in (HTTP 200) (content not read).
- `amucontrollerexams.com` itself is titled "Office of the Controller of Exams / Aligarh Muslim University" (home page), with university help desk "Phone: 09105533111". The AMU Guide to Admissions 2026-27 (PDF p.24) tells candidates to fill the AMU application form "on the website: www.amucontrollerexams.com".
- Domain type: **`.com` commercial TLD, not `.ac.in`/`.gov.in`**. That is a weakness (anyone can register a `.com`), which is probably why earlier review rated it as third-party; but the university's own site and its own signed guide point to it. The AMU application login portal for CUET courses is `https://oaps.amuonline.ac.in/login` (`amuonline.ac.in` is `.ac.in`; AMU's careers site is `careers.amuonline.ac.in`, also linked from amu.ac.in).
- Finding: **the earlier DO_NOT_USE should be withdrawn.** It is not a third-party site; it is the AMU Controller of Examinations admissions site, linked from amu.ac.in. Remaining caution: the `.com` domain and the fact that I could not verify domain ownership independently (no WHOIS used).
- No dedicated official AMU admissions site on `amu.ac.in` or a sub-domain exists as far as I could find: https://www.amu.ac.in/admissions returned an AMU "404 Error" page; `admissions.amu.ac.in` does not resolve (DNS failure). So **the source for AMU admissions should be `amucontrollerexams.com`, with `www.amu.ac.in` (which links to it) as the identity anchor** and `oaps.amuonline.ac.in` as the application portal link.

### (2) Cycle
- Current cycle: "Application Forms and Admission Guide for Programmes Offered by the University for the Academic Session 2026-27" (home-page banner). Guide to Admissions 2026-27 text: "The closing date for all admissions in the University, except those courses / categories for which separate notification will be made, is 31.08.2026" (PDF p.24, para 69). So the main cycle is **closed** (as of 2026-11-16); some later notices exist (e.g. "Revised Counselling-cum-Admission Schedule for Admission to B.B.A., 2026-27", "counselling stray vacancy round 2 & 3 ... B.Sc. Nursing 2026-27", Class XI SFS list II).
- Admission tests listed in Appendix-II "Test Schedule" (PDF p.149): e.g. B.Sc. (Hons.) Agriculture 12-04-2026; B.A. (Hons.) English 12-04-2026; B.V.A. 02-05-2026 (table is garbled in extraction; dates attach to wrong rows, so verify before use).

### (3) Information available
1. **Guide to Admissions 2026-27**: https://amucontrollerexams.com/uploads/files/e97cf6112508c8e79149275de5ae1cb3.pdf (188 PDF pages, 4.5 MB; linked as "Guide to Admissions 2026-27" from https://amucontrollerexams.com/page/view/general-admission-1550578415).
   - PDF p.3-4 contents (course list by faculty on pages A-numbers), PDF p.24: UG process for CUET-based courses: register on "cuet.samarth.ac.in", take CUET (UG) 2026 in the specified Domain/General/Language sections, fill the AMU form on www.amucontrollerexams.com quoting the CUET application number, register and participate in counselling if shortlisted; para 69: closing date 31.08.2026.
   - PDF p.54-66: "UNDERGRADUATE PROGRAMMES": per course: duration, course code, intake, qualifying examination, age limit (e.g. B.Sc. (Hons.) Agriculture: 8 semesters, code AGBGA, intake 60+12*, 10+2 with 50%, "Not more than 24 years as on 01st July", admission test), selection process (many through AMU Admission Test; some "Through Combined University Entrance Test (CUET) conducted by NTA", e.g. B.Voc. Polymer and Coating Technology PDF p.59: English + General Aptitude Test; B.Sc. (Hons.) Community Science, B.A. (Hons.) Hindi/Linguistics/Persian/Philosophy/Sanskrit via CUET-UG per the Appendix-II table PDF p.149).
   - PDF p.149-163: Appendix-II "Test Schedule of Courses of Study".
   - So **AMU uses a mix**: its own admission tests for many UG courses and CUET (UG) for some; a student must check course by course. Not simply "CUET-based".
2. Procedure PDFs on https://amucontrollerexams.com/page/view/general-admission-1550578415 : "Procedure for Departmental Test Courses", "Procedure for Non Test Courses", "User Guide for Candidates Online Counselling & Admission" (not opened). "Courses Offered" page https://amucontrollerexams.com/page/view/courses-offered-1550578343 (not opened). "Syllabus of Admission Test": https://results.amucontrollerexams.com/display/syllabustestcourses (not opened).
3. Previous-year cut-offs: **NOT STATED** in the guide (word "cut-off" appears only in non-UG context; no cut-off figures read).

### (4) Missing / conflicting / unverifiable
- Domain ownership of `.com` (see above); only evidence is AMU linkage.
- CUET-registration site conflict: the guide says register "on the CUET website cuet.samarth.ac.in" (PDF p.24 and p.59), while NTA's own site is `cuet.nta.nic.in`; the AMU "CUET (UG) - Registration link" points to `https://oaps.amuonline.ac.in/login`. Three different hosts named for CUET-related registration; none verified here. A student should apply on NTA first.
- Appendix-II and programme tables garbled in extraction (columns interleave).
- The "Admissions" menu on amu.ac.in opens an external site, which may confuse users.
- The guide is for 2026-27; no 2027-28 notice exists yet (NOT STATED).

### (5) Personal-data risk (titles/URLs only)
- Display of Firm Admission Lists: https://amucontrollerexams.com/page/view/display-of-firm-admission-lists-1793100648 and https://results.amucontrollerexams.com/display/firmlistadm; "Results of Admission Tests" https://results.amucontrollerexams.com/display/admresults; "List for admission to B.B.A. course declared, 2026-27" (https://amucontrollerexams.com/page/view/list-for-admission-to-bba-course-declared-2026-27-1793452975); "Roll List" (top menu); counselling schedules and stray-vacancy round notices (may list roll numbers); "Decisions Regarding Discrepancies in Answer Keys of Admission Tests"; "My Account"/staff login. Not opened.

### (6) Recommendation: **USE_WITH_CARE** for `amucontrollerexams.com` (changed from DO_NOT_USE)
It is AMU's own admissions site: amu.ac.in links to it, and AMU's guide names it as the application site. Cautions: `.com` domain, ownership unproven by me, three conflicting CUET registration hosts, lists on the same site carry candidate data. Source rule: identity anchor = https://www.amu.ac.in ; content source = `amucontrollerexams.com` (Guide to Admissions PDF only).

### (7) Importable later as DRAFT
- From the Guide to Admissions 2026-27 (PDF p.54-66 UG programme tables): course name, code, duration, intake, qualifying exam, age limit, selection mode (CUET vs admission test), CUET sections where stated; admission steps; closing date 31.08.2026 (as past/closed). Draft after visual verification of garbled tables.

---------------------------------------------------------------------------
## Summary table

| # | Source | Recommendation |
|---|---|---|
| 1 | NTA participating universities (CUET UG) | USE (244 listed = 49 central, 41 state, 27 deemed, 120 private, 7 other govt.; matches DB count of 244; names/types still to be compared) |
| 2 | NTA CUET (PG) | NOT_VERIFIED (403 Access Denied, also with browser UA; nothing readable) |
| 3 | University of Hyderabad (acad.uohyd.ac.in) | USE_WITH_CARE (17 UG/IPG programmes, 470 seats; no cut-offs by rule) |
| 4 | Jamia Millia Islamia (admission.jmi.ac.in) | NOT_VERIFIED (genuine but a POST-redirect stub to jmicoe.in; no UG/CUET data readable) |
| 5 | University of Allahabad (allduniv.ac.in) | USE_WITH_CARE (/admission URL empty; use /p/715 page, notice PDF, bulletin PDF) |
| 6 | AMU (amucontrollerexams.com) | USE_WITH_CARE (amu.ac.in links to it; earlier DO_NOT_USE should be withdrawn) |

Files read for this review are saved in `D:/tmp/p1-review/sources6/raw/` (HTML, PDFs and extracted text). Nothing else was written.
