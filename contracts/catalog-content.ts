import { catalogSchema } from './lesson.js';
import { demoCatalog, demoVersion } from './demo.js';
import { chemistryCatalog, chemistryVersion } from './chemistry.js';
import { physicsCatalog, physicsVersion } from './physics.js';

export const bundledCatalog = catalogSchema.parse({ nodes: [...demoCatalog.nodes, ...chemistryCatalog.nodes, ...physicsCatalog.nodes],
  lessons: [...demoCatalog.lessons, ...chemistryCatalog.lessons, ...physicsCatalog.lessons] });
export const bundledVersions = [demoVersion, chemistryVersion, physicsVersion];
