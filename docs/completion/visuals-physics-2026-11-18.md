# Physics visuals: audit and additions (2026-11-18)

Scope: the 31 CUET-UG Physics lesson packs `content/packs/CUET_UG/322/ug26-322-*.json`. Only DIAGRAM + CALLOUT blocks and `diagrams[]` entries were inserted; no existing block, question, key or id was changed. 26 new SVGs were added (121 existing -> 147).

Validator: `npm run ingest -- content-validate --exam CUET_UG --paper 322` prints OK for all 54 files (54 of 54 packs valid, no errors; the only warnings are the existing "similar question" notes). Every new SVG was rendered with `render-svg` and looked at.

## 1. Audit (existing diagrams and gaps)

| Lesson | Existing diagrams | Gap found | Action |
|---|---|---|---|
| u1-charges-coulomb | coulomb-forces, superposition-triangle, charged-ring, dipole | no F against r graph | added force-vs-distance |
| u1-electric-field | field lines (basic, pairs), dipole-field, dipole-torque | none important | none |
| u1-electric-potential | v-e-graph, dipole-potential, equipotentials, dipole-energy | U against r for like/unlike charges | added pe-two-charges |
| u1-gauss-law | flux-area, gaussian-surface, wire-cylinder, sheet-pillbox, spherical-shell (with E-r graph) | comparison of E-r for point/line/sheet | added field-vs-distance |
| u1-capacitors | conductor-field, polarisation, parallel-plate, combinations, energy-graph | none important | none |
| u2-current-resistance-cells | drift, vi-linear, vi-nonlinear, rho-temperature, internal-resistance, cell-combinations | no circuit diagram for Ohm's law; no random-vs-drift path picture | added ohm-circuit, electron-paths |
| u2-kirchhoff-wheatstone | rules, two-loop, cube, bridge | none important | none |
| u3-amperes-law | wire, solenoid, charge-paths, velocity-selector | none important | none |
| u3-bar-magnet | field-lines, axial-equatorial, torque | none important | none |
| u3-biot-savart-law | oersted, element, loop-axis | B against x on the axis | added axis-field-graph |
| u3-force-torque-current | conductor, parallel-wires, torque, dipole | tau against theta graph | added torque-vs-angle |
| u3-magnetic-materials | samples, temperature (Curie) | B-H hysteresis loop | added hysteresis-loop (see review notes) |
| u3-moving-coil-galvanometer | radial, sensitivity, conversion | none important | none |
| u4-ac-generator-transformer | generator, emf-graph, transformer | none important | none |
| u4-alternating-current | waveform, phasors-rlc, vi-graphs, lcr-phasor, resonance-curve, wattless | impedance triangle, X_L and X_C against frequency, p = vi waveforms, rotating phasor | added all four |
| u4-electromagnetic-induction | lenz-magnet, sliding-rod, coaxial-solenoids | flux and emf against time (Faraday + Lenz sign) | added flux-emf |
| u5-displacement-current | charging-capacitor, ampere-surfaces, b-vs-r | none important | none |
| u5-em-spectrum | chart | none | none |
| u5-em-waves | fields (3-D), wavefront | E and B in phase along x | added e-b-in-phase |
| u6-huygens-proofs, u6-wavefronts-huygens | 3 + 5 wavefront/proof diagrams | none | none |
| u6-interference-ydse | superposition, ydse-geometry, ydse-fringes | single-slit diffraction pattern is wanted but see "Not done" | not drawn |
| u6-optical-instruments | simple, compound, refracting, cassegrain | none | none |
| u6-ray-optics | concave-mirror (beyond C), convex-mirror, tir, optical-fibre, spherical-surface, convex-lens (F-2F), concave-lens, prism, dispersion | sign-convention picture, concave mirror inside F, Snell bending both ways, real/apparent depth, convex lens beyond 2F, delta against i | added six |
| u7-matter-waves | lambda-vs-momentum, electron-gun, lambda-vs-voltage | Davisson-Germer set-up | not drawn (see below) |
| u7-photoelectric-effect | apparatus, I-V (intensity), I-V (frequency), V0-nu, intensity-graphs | energy-balance picture | added energy-balance |
| u8-atomic-models | scattering-setup, alpha-trajectories, bohr-orbits, energy-levels | N(theta) graph, Balmer line spectrum | added both |
| u8-nuclei | nuclear-potential, binding-energy-curve, fission, fusion | R against A^(1/3) | added radius-vs-cube-root-a. Radioactive decay is not in the syllabus, so no decay curve |
| u9-diode-rectifier | half-wave, full-wave (centre tap), filter | bridge rectifier circuit | added bridge-rectifier |
| u9-energy-bands | band-formation, three-classes, temperature | none | none |
| u9-semiconductors-pn-diode | intrinsic-lattice, doped-lattices, impurity-levels, junction, bias, iv-curve (with breakdown) | diffusion/drift balance in the three bias states | added drift-diffusion. Zener is not in the syllabus row, so no Zener figure |

## 2. Added (26 diagrams)

| Lesson | Key | File (in diagrams/) | What the student learns |
|---|---|---|---|
| u1-charges-coulomb | force-vs-distance | ug26-322-u1-charges-coulomb-force-distance.svg | F falls as 1/r2: F, F/4, F/9 at r0, 2r0, 3r0 |
| u1-electric-potential | pe-two-charges | ug26-322-u1-electric-potential-pe-two-charges.svg | sign and r-dependence of U for like and unlike charges |
| u1-gauss-law | field-vs-distance | ug26-322-u1-gauss-law-field-vs-distance.svg | E against r: 1/r2 (point), 1/r (line), constant (sheet) |
| u2-current-resistance-cells | ohm-circuit | ug26-322-u2-current-resistance-cells-ohm-circuit.svg | ammeter in series, voltmeter in parallel, rheostat, key |
| u2-current-resistance-cells | electron-paths | ug26-322-u2-current-resistance-cells-electron-paths.svg | random motion versus slow drift opposite to E |
| u3-biot-savart-law | axis-field-graph | ug26-322-u3-biot-savart-law-axis-field-graph.svg | B along the coil axis: maximum at centre, 0.35 B0 at x = R |
| u3-force-torque-current | torque-vs-angle | ug26-322-u3-force-torque-current-torque-vs-angle.svg | tau = NIAB sin(theta); stable and unstable zeros |
| u3-magnetic-materials | hysteresis-loop | ug26-322-u3-magnetic-materials-hysteresis-loop.svg | virgin curve, saturation, retentivity, coercivity, loop area |
| u4-alternating-current | reactance-vs-frequency | ug26-322-u4-alternating-current-reactance-vs-frequency.svg | X_L rises, X_C falls, equal at nu0 |
| u4-alternating-current | impedance-triangle | ug26-322-u4-alternating-current-impedance-triangle.svg | Z2 = R2 + (X_L - X_C)2 and tan(phi) |
| u4-alternating-current | power-waveforms | ug26-322-u4-alternating-current-power-waveforms.svg | p = vi for resistor (never negative) and pure inductor (zero average) |
| u4-alternating-current | rotating-phasor | ug26-322-u4-alternating-current-rotating-phasor.svg | a phasor's vertical projection is the sinusoid |
| u4-electromagnetic-induction | flux-emf | ug26-322-u4-electromagnetic-induction-flux-emf.svg | emf = minus slope of the flux graph; sign and size |
| u5-em-waves | e-b-in-phase | ug26-322-u5-em-waves-e-b-in-phase.svg | E and B in phase, wavelength, E0 = cB0 |
| u6-ray-optics | sign-convention | ug26-322-u6-ray-optics-sign-convention.svg | Cartesian signs for u, v, f, R and heights |
| u6-ray-optics | concave-mirror-inside-f | ug26-322-u6-ray-optics-concave-mirror-inside-f.svg | object between P and F gives a virtual, erect, magnified image |
| u6-ray-optics | snell-refraction | ug26-322-u6-ray-optics-snell-refraction.svg | bending towards / away from the normal (50/30.7 and 25/39.3 degrees, n = 1.5) |
| u6-ray-optics | apparent-depth | ug26-322-u6-ray-optics-apparent-depth.svg | why an under-water object looks nearer: h' = h/n |
| u6-ray-optics | convex-lens-beyond-2f | ug26-322-u6-ray-optics-convex-lens-beyond-2f.svg | three-ray construction, real inverted diminished image |
| u6-ray-optics | deviation-graph | ug26-322-u6-ray-optics-deviation-graph.svg | U-shaped delta against i, minimum at i = e (A = 60, n = 1.5) |
| u7-photoelectric-effect | energy-balance | ug26-322-u7-photoelectric-effect-energy-balance.svg | h nu = phi0 + K_max as an energy level picture |
| u8-atomic-models | rutherford-scattering-graph | ug26-322-u8-atomic-models-rutherford-scattering-graph.svg | N proportional to 1/sin4(theta/2): mostly small-angle scattering |
| u8-atomic-models | balmer-lines | ug26-322-u8-atomic-models-balmer-lines.svg | 656, 486, 434, 410 nm lines and the 365 nm limit |
| u8-nuclei | radius-vs-cube-root-a | ug26-322-u8-nuclei-radius-vs-cube-root-a.svg | R = R0 A^(1/3) is a straight line of slope 1.2 fm |
| u9-diode-rectifier | bridge-rectifier | ug26-322-u9-diode-rectifier-bridge-rectifier.svg | current path through D1/D4 and D2/D3 in the two half-cycles |
| u9-semiconductors-pn-diode | drift-diffusion | ug26-322-u9-semiconductors-pn-diode-drift-diffusion.svg | how bias changes diffusion current while drift stays about the same |

Per lesson: ray-optics 6; alternating-current 4; current-resistance-cells 2; atomic-models 2; one each in charges-coulomb, electric-potential, gauss-law, biot-savart-law, force-torque-current, magnetic-materials, electromagnetic-induction, em-waves, photoelectric-effect, nuclei, diode-rectifier, semiconductors-pn-diode.

Numbers in figures are computed, not invented: prism curve from the prism formulas (A = 60, n = 1.5), Snell angles from n = 1.5, Balmer wavelengths from R = 1.097 x 10^7 per metre, radii from R0 = 1.2 fm (the lesson's own value). Graphs of shape only are labelled "illustrative" in the figure.

## 3. Not done (and why)

- Single-slit diffraction intensity pattern: the syllabus has a row "Diffraction due to a single slit, width of central maxima", but there is no lesson pack for it among the 31, and the YDSE lesson does not teach it. A figure there would have no text to support it. Needs a lesson first.
- Davisson-Germer set-up: the matter-waves lesson mentions the experiment, but I was not certain of the scattering-angle convention (50 degrees measured from which axis), so I did not draw it.
- Radioactive decay curve, Zener I-V: not in the syllabus rows.
- Lens-combination, mirror cases for object at C and F (partly covered by existing diagrams and tables), meter bridge, potentiometer, cyclotron: not in the syllabus rows or already covered.

## 4. Needs subject-expert review

1. **Hysteresis loop (u3-magnetic-materials)**: the syllabus row names para-, dia- and ferromagnetism, magnetisation and temperature, not hysteresis, and the lesson text did not mention hysteresis, retentivity or coercivity. The owner asked for a B-H loop, so it was added with a callout that defines the terms. Decide whether to keep it, and whether to add text to the lesson. The curve shape is schematic (tanh branches).
2. **Apparent depth (u6-ray-optics)**: ray angles (6 and 12 degrees) are exaggerated so the rays can be told apart, and the drawn h'/h is about 0.73 against the paraxial 0.75. The figure says this.
3. **Concave mirror inside F and the sign-convention figure**: the rays hit the drawn circular arc (R drawn large) and the image tip is where the backward extensions meet. Image distance is about 0.88 of the exact paraxial value for the drawn heights; check that this level of accuracy is acceptable for a diagram.
4. **Bridge rectifier**: diode labelling D1 to D4 and node names A, B, T, U are my own; check they do not clash with the wording of the lesson paragraph "For reference: the bridge rectifier".
5. **Drift-diffusion picture**: arrow thicknesses are qualitative. The statement that drift current stays about the same in forward bias and reverse bias is the standard textbook simplification (it depends on minority carriers).
6. **Rutherford N(theta) graph**: uses the small-angle-to-large-angle 1/sin4(theta/2) shape with relative values (4 at 90 degrees, 1 at 180 degrees); the curve is cut at 50 degrees because it runs off the page.
7. **Electron-paths figure**: collision paths are drawn as straight segments (real paths between collisions are slightly curved); marked "schematic".
8. **Power waveforms**: in the resistor panel v and i coincide (only the green dashes show); the average line is V0 I0 / 2.
