# Physics: content that needs a subject-expert check (19 November 2026)

Everything below was written or drawn by AI and is **Draft – unverified**. Nothing here has been reviewed by a physics subject expert. Each item says what to check and why it is a risk. Numbers were recomputed by unit tests, but a test only proves the code matches the formula the code was given; an expert must confirm the formula, the sign convention and the wording.

## A. The new lesson: "Diffraction of light: single slit and the width of the central maximum"
File: `content/packs/CUET_UG/322/ug26-322-u6-single-slit-diffraction.json` (+ 4 figures in `diagrams/ug26-322-u6-diffraction-*.svg`).

| What | Check |
|---|---|
| Half-slit path-difference derivation of a sin θ = nλ | Is the argument acceptable for CUET level? Wording of "pairs cancel". |
| Secondary maxima "approximately at a sin θ = (n + ½)λ" | Standard approximation, but state clearly it is approximate. |
| "About 5 % and 2 % of the central intensity" for the first and second secondary maxima | Exact values from sinc² are 4.7 % and 1.6 %; the lesson rounds them. Confirm the rounding is acceptable. |
| Fresnel distance z_F = a²/λ and "ray optics holds well below z_F" | NCERT states this; check the wording matches the syllabus. |
| Single-slit versus double-slit table, and "d = 4a: seven fringes, the fourth order is missing" | Check the claim and the figure. |
| 7 solved problems (numbers: 1.2 cm, 2.0 mm, 1.18 µm, 3.0 mm, 5.0 mm, 32 m, six minima) | Re-derive each. |
| 20 questions, keys and explanations (`ug26-322-u6-single-slit-diffraction-q01` to `q20`) | Check each key, especially the assertion-reason (q13, q14), the statement questions (q15, q16) and q20 (five fringes for d = 3a). |
| Figures: set-up, half-slit construction, intensity curve, envelope | Labels, the sign of the extra path in the construction figure, the drawn secondary-maxima heights. |

## B. Interactive labs (physics models and teaching claims)
Each lab also has 4 prediction items and 4 to 5 practice questions with explanations (defined in the lab's `visual/<lab>.ts`, checked by tests in `<lab>.test.ts`).

| Lab | Model and claims to verify |
|---|---|
| **Lens Lab** (`visual/lens.ts`) | New Cartesian sign convention (u < 0 for a real object; f > 0 convex); 1/v − 1/u = 1/f; m = v/u; the three principal rays for convex and concave lenses (including the ray "aimed at F′" for a concave lens); power P = 100/f (f in cm). Practice questions `a1`–`a4`. |
| **Diffraction Lab** (`visual/diffraction.ts`) | Fresnel-integral model of a slit at any distance; far-field sinc² pattern; central width 2λD/a and 2λf/a with a lens; the thresholds used to label the regime (Fresnel number below 0.05 = far field, 0.05 to 1 = in between, 1 or more = near field) are **teaching conventions, not standard cut-offs**; "narrower slit gives a dimmer pattern" and the quoted peak brightness a²/(λD). Practice questions `a1`–`a5`. |
| **Young's double-slit 3D lab** (`visual/young.ts`, `visual/young3d/`) | β = λD/d; exact path difference; intensity = cos²(πΔ/λ) × single-slit envelope (slit width fixed at 50 µm, an assumption); one slit covered gives a quarter of the peak and no fringes; sheet shift (μ − 1)tD/d; fringe width in a medium β/μ. **Magnified wave model:** cylindrical waves ∝ e^{ikr}/√r with d = 4λ at the default settings. Its geometry is exact but its absolute wavelength and separation are not to scale: confirm the on-screen labelling is acceptable and not misleading. The slit separation of the 3D plate is drawn larger than life. The guided tours' wording and the derivation lines. Practice questions `ya1`–`ya5` (note `ya4` counts dark fringes from the centre: first dark = λ/2). |
| **Electric Field and Coulomb Lab** (`visual/efield.ts`) | Coulomb force with the correct direction; superposition; field-line rules (leave +, enter −; **number of lines drawn proportional to charge, 4 per µC, is a drawing convention**); the dipole field on axis and on the equator and p = qd; units scaled to µC and cm; the zero-field point between equal charges. The F against 1/r² fit for k. Practice questions in `efield.ts`. |
| **Circuit lab** (in progress) | Review when delivered: Ohm's law, internal resistance (V = E − Ir), Kirchhoff's rules, Wheatstone balance. |

## C. Question banks and syllabus mapping
- Physics now has 1,020 pack questions plus about 19 lab questions. All were AI-assisted; none carries expert approval. The existing bank was not changed in this work.
- The syllabus mapping (32 rows to 32 lessons) in `docs/completion/physics-audit-2026-11-19.md` should be checked against the official NTA syllabus text, row by row.
- Not available yet: passage or case-based questions and previous-year questions (only one 2024 paper pilot).

## D. How to record the review
Mark each item reviewed, corrected or rejected in this file. Only after an expert signs off should any content lose its "Draft – unverified" label, which is controlled in the content packs' `origin` field and the labs' badges.
