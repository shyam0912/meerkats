import { catalogSchema, lessonVersionSchema } from '../../contracts/lesson';

async function read(path: string) {
  const response = await fetch(`/api/v1/${path}`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Catalog unavailable');
  return response.json() as Promise<unknown>;
}
export async function loadCatalog() {
  return import.meta.env.VITE_API_ENABLED === 'true' ? catalogSchema.parse(await read('catalog')) : (await import('../../contracts/catalog-content')).bundledCatalog;
}
export async function loadLessonVersion(id: string) {
  if (import.meta.env.VITE_API_ENABLED === 'true') return lessonVersionSchema.parse(await read(`lesson-versions/${id}`));
  const { bundledVersions } = await import('../../contracts/catalog-content');
  const version = bundledVersions.find(v => v.id === id);
  if (!version) throw new Error('Lesson version unavailable');
  return lessonVersionSchema.parse(version);
}
