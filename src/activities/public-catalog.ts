import { catalogSchema } from '../../contracts/lesson';
import { chemistryCatalog, publicChemistryVersion } from '../../contracts/chemistry-content';
import { physicsCatalog, physicsVersion } from '../../contracts/physics';
import { countingCatalog, countingVersion } from '../../contracts/counting-content';

export const bundledCatalog = catalogSchema.parse({
  nodes: [...chemistryCatalog.nodes, ...physicsCatalog.nodes, ...countingCatalog.nodes],
  lessons: [...chemistryCatalog.lessons, ...physicsCatalog.lessons, ...countingCatalog.lessons],
});
export const bundledVersions = [publicChemistryVersion, physicsVersion, countingVersion];
