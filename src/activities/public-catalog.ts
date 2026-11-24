import { catalogSchema } from '../../contracts/lesson';
import { chemistryCatalog, publicChemistryVersion } from '../../contracts/chemistry-content';
import { physicsCatalog, physicsVersion } from '../../contracts/physics';
import { countingCatalog, countingVersion } from '../../contracts/counting-content';
import { plantCatalog, plantVersion } from '../../contracts/plant-content';
import { fractionsCatalog, fractionsVersion } from '../../contracts/fractions-content';

export const bundledCatalog = catalogSchema.parse({
  nodes: [...chemistryCatalog.nodes, ...physicsCatalog.nodes, ...countingCatalog.nodes, ...plantCatalog.nodes, ...fractionsCatalog.nodes],
  lessons: [...chemistryCatalog.lessons, ...physicsCatalog.lessons, ...countingCatalog.lessons, ...plantCatalog.lessons, ...fractionsCatalog.lessons],
});
export const bundledVersions = [publicChemistryVersion, physicsVersion, countingVersion, plantVersion, fractionsVersion];
