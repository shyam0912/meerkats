import { describe, expect, it } from 'vitest';
import { bundledCatalog } from '../../../contracts/catalog-content';
import { CHEMISTRY } from '../../../contracts/chemistry';
import { catalogPath, chapterLabel, discovery } from './discovery';

describe('catalog presentation', () => {
  it('uses stable IDs and the exact topic ownership, regardless of labels', () => {
    const data = structuredClone(bundledCatalog);
    data.nodes.forEach(n => { n.title = 'Renamed'; });
    expect(discovery(data, CHEMISTRY.class).nodes.map(n => n.id)).toEqual([CHEMISTRY.subject]);
    expect(discovery(data, CHEMISTRY.subject).nodes.map(n => n.id)).toEqual([CHEMISTRY.chapter]);
    expect(discovery(data, CHEMISTRY.chapter).nodes.map(n => n.id)).toEqual([CHEMISTRY.topic]);
    expect(discovery(data, CHEMISTRY.chapter).lessons).toEqual([]);
    expect(discovery(data, CHEMISTRY.topic).lessons.map(l => l.id)).toEqual([CHEMISTRY.lesson]);
    expect(catalogPath(CHEMISTRY.topic)).toBe('/catalog?parent=' + CHEMISTRY.topic);
    expect(discovery(data, CHEMISTRY.topic).ancestors.map(n => n.id)).toEqual([CHEMISTRY.curriculum, CHEMISTRY.class, CHEMISTRY.subject, CHEMISTRY.chapter]);
  });
  for (const [id, kind, empty] of [
    [null, 'class', 'No classes available yet'],
    [CHEMISTRY.class, 'subject', 'No subjects available yet'],
    [CHEMISTRY.subject, 'chapter', 'No chapters available yet'],
    [CHEMISTRY.chapter, 'topic', 'No concepts available yet'],
    [CHEMISTRY.topic, 'lesson', 'Lesson not available yet'],
  ] as const) {
    it('truthfully handles missing ' + kind, () => {
      const data = structuredClone(bundledCatalog);
      data.nodes = data.nodes.filter(n => n.kind !== kind); data.lessons = [];
      const view = discovery(data, id);
      expect(view.nodes).toEqual([]); expect(view.lessons).toEqual([]); expect(view.empty).toBe(empty);
      expect(view.title).not.toBe('Ready to teach');
    });
  }
  it('does not invent chapter numbers from ordering', () => {
    expect(chapterLabel('Unit 1 · Nomenclature')).toEqual({ number: 'Unit 1', title: 'Nomenclature' });
    expect(chapterLabel('Observe and describe')).toEqual({ number: null, title: 'Observe and describe' });
  });
  it('rejects unknown or curriculum-level selections', () => {
    expect(discovery(bundledCatalog, 'missing').invalid).toBe(true);
    expect(discovery(bundledCatalog, CHEMISTRY.curriculum).invalid).toBe(true);
    expect(discovery(bundledCatalog, null).invalid).toBe(false);
  });
});
