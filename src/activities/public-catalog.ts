import { catalogSchema } from '../../contracts/lesson';
import { chemistryCatalog, publicChemistryVersion } from '../../contracts/chemistry-content';
import { physicsCatalog, physicsVersion } from '../../contracts/physics';
import { countingCatalog, countingVersion } from '../../contracts/counting-content';
import { plantCatalog, plantVersion } from '../../contracts/plant-content';

export const bundledCatalog = catalogSchema.parse({
  nodes: [...chemistryCatalog.nodes, ...physicsCatalog.nodes, ...countingCatalog.nodes, ...plantCatalog.nodes],
  lessons: [...chemistryCatalog.lessons, ...physicsCatalog.lessons, ...countingCatalog.lessons, ...plantCatalog.lessons],
});
export const bundledVersions = [publicChemistryVersion, physicsVersion, countingVersion, plantVersion];
