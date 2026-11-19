/** Soft, coordinated colours for the subjects: a node background and a small dot. Chosen by the subject's place in the alphabetical subject list, so the sidebar and the study map agree. */
export const SUBJECT_TONES = [
  { node: '#ecbba5', dot: '#c45e42' }, // terracotta tint
  { node: '#d8cde6', dot: '#b8a6d6' }, // lilac
  { node: '#e6f28e', dot: '#d9c84f' }, // pale lime
  { node: '#bfd6c2', dot: '#7fc09a' }, // sage green
  { node: '#ecd9a6', dot: '#dcb857' }, // sand
  { node: '#bdd3d0', dot: '#74b3b0' }, // pale teal
  { node: '#e8c5c5', dot: '#d98f8f' }, // dusty rose
] as const;
export const subjectTone = (index: number) => SUBJECT_TONES[((index % SUBJECT_TONES.length) + SUBJECT_TONES.length) % SUBJECT_TONES.length]!;
