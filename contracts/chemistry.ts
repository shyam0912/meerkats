import { publicChemistryVersion } from './chemistry-content.js';

export { CHEMISTRY, chemistryCatalog, pentane, methylbutane } from './chemistry-content.js';

// Preserve the published development/seed record, including its authoring provenance.
export const chemistryVersion = {
  ...publicChemistryVersion,
  provenance: {
    ...publicChemistryVersion.provenance,
    note: 'Owner-supplied 10_Chemistry Eng.pdf. Original Meerkats graphics and interactions; no textbook artwork reproduced. Source mapped in docs/phase-5-source.md. Academic teacher review pending; publication freezes this technical version, not academic approval.',
  },
};
