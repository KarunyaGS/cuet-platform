# Visual aids: Mathematics (319), lessons r00 to r06 (agent math-a), 2026-11-18

## 1. Lessons audited (7)

r00 matrices-determinants-algebra, r01 numerical-applications, r02 applied-algebra-matrices, r03 calculus-derivatives-extrema, r04 applied-calculus, r05 integration-applications, r06 probability-distributions-applied. Packs are in `content/packs/CUET_UG/319/`.

No existing block, question, key or id was changed. Only DIAGRAM + CALLOUT block pairs were inserted and each pack's `diagrams` array was filled. Every figure was produced by a generator script (`D:\tmp\gen-math-a\`) that computes the curves, areas, sums and probabilities, and aborts if a number printed on the figure disagrees with its own computation (integrals by Simpson's rule, binomial and Poisson pmf, erf for normal areas, matrix product, determinant versus shoelace area, remainder cycle).

## 2. Figures added (28)

File names all begin `ug26-319-<lesson id>-<lesson slug>-` and sit in `content/packs/CUET_UG/319/diagrams/`; the suffix is shown below.

| Lesson | Key | File suffix | Title | What the student learns |
|---|---|---|---|---|
| r00 | row-by-column | row-by-column | Row of A times column of B | Entry (2,1) = 4x7+5x9+6x11 = 139 for a 2x3 by 3x2 product; matching inner order |
| r00 | determinant-area | determinant-area | Determinant as parallelogram area | ad-bc = 5 is an area; columns on one line give 0 (singular) |
| r00 | three-cases | three-cases | Two equations as lines | unique, none, infinite, with \|A\| and (adj A)B |
| r01 | modulo-cycle | modulo-cycle | Powers of 3 mod 7 | 3,2,6,4,5,1 repeats; 3^20 = 2 |
| r01 | allegation-cross | allegation-cross | Cross method and price line | 9:6 = 3:2 for Rs 40 and Rs 55 at mean Rs 46 |
| r01 | percent-bars | percent-bars | Bar model | 20% more is 16 2/3% less (different base) |
| r01 | average-speed | average-speed | Distance-time graph | average speed = slope of whole trip = 48 km/h |
| r01 | inequality-line | inequality-line | -2x+3 >= 11 on a number line | x <= -4, sign reversal, test points |
| r02 | transpose | transpose | Transpose | rows become columns, order flips |
| r02 | symmetric-skew | symmetric-skew | Symmetric versus skew | mirror pairs equal or opposite, zero diagonal |
| r02 | shop-product | shop-product | Sales times prices | row-by-column in the lesson's revenue example (1000, 750) |
| r02 | three-cases | three-cases | Matrix method, three cases | adj A test matches the picture (different equations from r00) |
| r03 | increasing-decreasing | increasing-decreasing | f and f' stacked | sign of f' gives rising or falling for 2x^3-9x^2+12x+5 |
| r03 | first-derivative-test | first-derivative-test | x^3-3x extrema and concavity | + to - gives a maximum, - to + a minimum; f'' signs |
| r03 | absolute-extrema | absolute-extrema | Closed interval | absolute minimum at an end point; compare end points and critical points |
| r03 | open-box-volume | open-box-volume | Open box | V = x(12-2x)^2, maximum 128 at x = 2 |
| r04 | family-of-curves | family-of-curves | y = x^2+3x+C | same slope, vertical shifts; (0,5) fixes C = 5 |
| r04 | area-under-sqrt | area-under-sqrt | Area under sqrt x from 1 to 4 | 14/3 |
| r04 | consumer-surplus | consumer-surplus | CS for p = 20-2x, p0 = 8 | CS = 36 (84 - 48) |
| r04 | producer-surplus | producer-surplus | PS for p = 2x+4, p0 = 12 | PS = 16 (48 - 32) |
| r05 | riemann-sums | riemann-sums | Rectangle sums, x^2 on [1,2] | lower 1.969 < 7/3 < upper 2.719; table up to n = 1000 |
| r05 | odd-even-symmetric | odd-even-symmetric | Odd and even over [-2,2] | 0 versus 16/3 (table row P6) |
| r05 | area-sine-two-parts | area-sine-two-parts | sin x on [0, 2 pi] | integral 0 but area 4 |
| r05 | area-parabola-axis | area-parabola-axis | y = 4x-x^2 and the x-axis | roots as limits, area 32/3 |
| r06 | expectation-balance | expectation-balance | Distribution and mean | E(X) = 1.7 as balance point, Var = 0.81 |
| r06 | binomial-histogram | binomial-histogram | Binomial n = 5, p = 0.2 | at least one = 1 - P(0) = 0.67232 |
| r06 | poisson-histogram | poisson-histogram | Poisson lambda = 3 | P(0) = 0.0498, P(at most 1) = 0.1991 |
| r06 | normal-curve-areas | normal-curve-areas | Normal 68-95-99.7 | nested regions; marks 56 to 88 = mu +/- 2 sigma |

Each figure is followed by a "What to learn from this figure" CALLOUT.

## 3. New tables

None. Each lesson already has the comparison tables it needs (types of matrices, determinant properties, tests for extrema, area relationship of the normal curve, and so on).

## 4. Topics given no figure

- Tangent as limit of secants: r03 and r04 do not teach the first-principles derivative, so not drawn.
- Area between two curves: r05 teaches only area under one curve, so not drawn.
- Logarithm and exponential curves: not covered in r01, so not drawn.
- Boats and streams, pipes and cisterns, races: covered but routine arithmetic; left out to keep r01 near 5 figures.
- Marginal cost and profit curves (r04): the cost curve is almost a straight line, so a picture adds little.

## 5. Needs subject-expert review

1. r00 determinant-area: the lesson does not teach the area meaning of a determinant. Claim to check: for a 2x2 matrix with columns u and v, |ad-bc| is the area of the parallelogram on u and v, and it is 0 when the columns are collinear. The callout calls it extra intuition. Remove the figure if the lesson must stay strictly within its own text.
2. r01 allegation-cross: the cheaper price's row carries 55-46 = 9 and the dearer price's row carries 46-40 = 6 (consistent with the lesson formula). Check that this is the layout convention taught in coaching.
3. r03 first-derivative-test: uses the wording "bends down / bends up" for f'' < 0 and f'' > 0. The lesson uses the second derivative test but never defines concavity.
4. r04 consumer and producer surplus: lines and equilibria come from the lesson's own problems; check the labels "paid 48" and "cost along supply 32" are acceptable wording.
5. r05 riemann-sums: "lower" and "upper" sums rely on x^2 being increasing on [1,2] (left-end rectangles lie below the curve, right-end above). The lesson only says the integral is a limit of sums of thin rectangles and does not name lower or upper sums.
6. r06 normal-curve-areas: the figure prints 68.3, 95.4 and 99.7 (computed 68.27, 95.45, 99.73), matching the lesson's table; the marks scale (mean 72, sd 8, 48 to 96) is from the lesson's solved problem.
7. r06 expectation-balance: describing the mean as the balance point of the bars is standard intuition, not stated in the lesson.
8. All figures use unicode symbols in SVG text (mu, sigma, pi, superscript and subscript digits). They render in the preview renderer; confirm on the production font stack.

## Verification

`npm run ingest -- content-validate --exam CUET_UG --paper 319` prints OK for all seven files (diagram counts 3, 5, 4, 4, 4, 4, 4). The only warnings are pre-existing similar-question notices; no question was touched. Every SVG was rendered with `render-svg` and viewed; overlaps and clipped labels were fixed and re-rendered.
