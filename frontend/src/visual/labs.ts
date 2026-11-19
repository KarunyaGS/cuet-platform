/**
 * Registry of interactive labs and where each one appears in an existing lesson.
 * A lab is shown as a card at the END of the named section, so no lesson text is changed or duplicated.
 * Adding a lab is one entry here plus its page and route. Status of all lab content: Draft - unverified.
 */
export interface LabEntry {
  id: string;
  /** The lesson's title starts with this. */
  lessonTitleStartsWith: string;
  /** Exact text of the section heading after which the card appears. */
  afterHeading: string;
  path: string;
  title: string;
  blurb: string;
  can: string[];
  minutes: number;
}

export const LABS: LabEntry[] = [
  {
    id: 'lens',
    lessonTitleStartsWith: 'Ray optics',
    afterHeading: 'Thin lenses and the thin lens formula',
    path: '/lab/lens',
    title: 'Lens Lab',
    blurb: 'Move an object along an optical bench, switch between convex and concave lenses, and see where the image forms.',
    can: ['Drag the object and watch the three principal rays', 'Predict the image, then test it', 'Record u and v readings and check 1/v − 1/u = 1/f'],
    minutes: 10,
  },
  {
    id: 'diffraction',
    lessonTitleStartsWith: 'Diffraction of light',
    afterHeading: 'Width of the central maximum',
    path: '/lab/diffraction',
    title: 'Diffraction Lab',
    blurb: 'Send light through a single slit and see the pattern it makes. Change the slit width, the colour and the screen, and test the formula for the width of the central maximum.',
    can: ['Predict how the pattern changes, then test it', 'Drag a probe to the dark bands and read a sin θ = nλ', 'Record widths and check that they follow 2λD/a, near field and far field'],
    minutes: 12,
  },
  {
    id: 'young',
    lessonTitleStartsWith: 'Coherent sources',
    afterHeading: 'Expression for fringe width',
    path: '/lab/young',
    title: 'Young’s Double-Slit 3D Lab',
    blurb: 'Walk around a real optical bench in 3D, watch the waves from both slits overlap, and measure the fringe width yourself as you change the wavelength, the slit separation and the screen distance.',
    can: ['Rotate, zoom and inspect the laser, the slit plate and the screen', 'Watch waves from two coherent sources add and cancel', 'Predict, measure and fit the fringe width β = λD/d'],
    minutes: 20,
  },
  {
    id: 'efield',
    lessonTitleStartsWith: 'Electric charges',
    afterHeading: 'Forces between multiple charges: the superposition principle',
    path: '/lab/efield',
    title: 'Electric Field Lab',
    blurb: 'Drag positive and negative charges around, see the Coulomb forces and the field lines change live, and measure how the force depends on distance.',
    can: ['Drag charges and watch the force arrows and field lines', 'Predict, then test: distance, charge size, attraction and repulsion', 'Measure F at three distances and find k from a straight-line graph'],
    minutes: 15,
  },
  {
    id: 'efield',
    lessonTitleStartsWith: 'Electric field, field lines',
    afterHeading: 'Electric field lines',
    path: '/lab/efield',
    title: 'Electric Field Lab',
    blurb: 'Place charges, drag a field probe around them, and see how the field lines, the field arrows and a dipole behave.',
    can: ['Watch field lines run from + to − with density proportional to charge', 'Move a probe and read the field from every charge added together', 'Try the dipole and compare its axial and equatorial fields'],
    minutes: 15,
  },
];

export const labFor = (lessonTitle: string, heading: string) => LABS.find((l) => lessonTitle.startsWith(l.lessonTitleStartsWith) && l.afterHeading === heading);
export const labHref = (lab: LabEntry, lessonId: string, headingSlug: string) => `${lab.path}?lesson=${encodeURIComponent(lessonId)}&section=${encodeURIComponent(headingSlug)}`;
