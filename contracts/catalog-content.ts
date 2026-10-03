import { catalogSchema } from './lesson.js';
import { demoCatalog, demoVersion } from './demo.js';
import { chemistryCatalog, chemistryVersion } from './chemistry.js';

export const bundledCatalog = catalogSchema.parse({ nodes: [...demoCatalog.nodes, ...chemistryCatalog.nodes],
  lessons: [...demoCatalog.lessons, ...chemistryCatalog.lessons] });
export const bundledVersions = [demoVersion, chemistryVersion];
