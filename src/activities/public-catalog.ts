import { catalogSchema } from '../../contracts/lesson';
import { chemistryCatalog, publicChemistryVersion } from '../../contracts/chemistry-content';
import { physicsCatalog, physicsVersion } from '../../contracts/physics';

export const bundledCatalog = catalogSchema.parse({
  nodes: [...chemistryCatalog.nodes, ...physicsCatalog.nodes],
  lessons: [...chemistryCatalog.lessons, ...physicsCatalog.lessons],
});
export const bundledVersions = [publicChemistryVersion, physicsVersion];
