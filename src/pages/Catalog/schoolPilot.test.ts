import { describe, expect, it } from 'vitest';
import { bundledCatalog } from '../../../contracts/catalog-content';
import { CHEMISTRY, chemistryVersion } from '../../../contracts/chemistry';
import { PHYSICS } from '../../../contracts/physics';
import { DEMO } from '../../../contracts/demo';
import { compactContext, contentState, pilotClassId, plannedStandard, schoolCatalog, standardChoices, teacherLabel } from './schoolPilot';

describe('school pilot presentation boundaries', () => {
  it('shows ten choices but never turns planned standards into catalog records', () => {
    const before = structuredClone(bundledCatalog);
    const choices = standardChoices(schoolCatalog(bundledCatalog));
    expect(choices.map(c => c.number)).toEqual([1,2,3,4,5,6,7,8,9,10]);
    expect(choices.slice(0, 9).every(c => !c.node && c.path === '/catalog?standard=' + c.number)).toBe(true);
    expect(choices[9]!.node!.id).toBe(CHEMISTRY.class);
    expect(pilotClassId).toBe(CHEMISTRY.class);
    expect(bundledCatalog).toEqual(before);
  });
  it('excludes the internal fixture at every depth regardless of API node ordering', () => {
    const result = schoolCatalog({ ...bundledCatalog, nodes: [...bundledCatalog.nodes].reverse() });
    expect(result.nodes.map(n => n.id).sort()).toEqual(bundledCatalog.nodes.filter(n => !n.id.startsWith('40000000')).map(n => n.id).sort());
    expect(result.lessons.map(l => l.id)).toEqual([CHEMISTRY.lesson, PHYSICS.lesson]);
    expect(result.nodes.some(n => n.id === DEMO.topic)).toBe(false);
  });
  it('keeps Standard 10 planned when its catalog node is absent', () => {
    const choices = standardChoices({ nodes: [], lessons: [] });
    expect(choices.every(c => !c.node)).toBe(true); expect(choices[9]!.path).toBe('/catalog?standard=10');
  });
  it('never marks technical publication or an unloaded version as Ready', () => {
    const definition = bundledCatalog.lessons.find(l => l.id === CHEMISTRY.lesson)!;
    expect(contentState(definition)).toBe('Preview');
    expect(contentState(definition, chemistryVersion)).toBe('Preview');
    expect(contentState()).toBe('Planned');
  });
  it('requires review and matching lesson/version identity for Ready', () => {
    const definition = bundledCatalog.lessons.find(l => l.id === CHEMISTRY.lesson)!;
    const reviewed = structuredClone(chemistryVersion);
    reviewed.provenance.reviewStatus = 'reviewed';
    expect(contentState(definition, reviewed)).toBe('Ready');
    reviewed.id = DEMO.version; expect(contentState(definition, reviewed)).toBe('Preview');
    reviewed.id = CHEMISTRY.version; reviewed.lessonId = DEMO.lesson;
    expect(contentState(definition, reviewed)).toBe('Preview');
    expect(chemistryVersion.provenance.reviewStatus).toBe('teacher-review-pending');
  });
  it('keeps teacher labels and compact context separate from stored names', () => {
    const nodes = bundledCatalog.nodes.filter(n => [CHEMISTRY.curriculum, CHEMISTRY.class, CHEMISTRY.subject, CHEMISTRY.chapter].includes(n.id as typeof CHEMISTRY.class));
    expect(compactContext(nodes)).toBe('Standard 10 / Chemistry / Unit 1');
    expect(teacherLabel(nodes.find(n => n.id === CHEMISTRY.class)!)).toBe('Standard 10');
    expect(nodes.find(n => n.id === CHEMISTRY.class)!.title).toBe('Standard X');
  });
  it('only accepts bounded planned standard routes', () => {
    for (const input of [null, '', '0', '11', '01', '-1', '1.5', 'x']) expect(plannedStandard(input)).toBeNull();
    for (let i = 1; i <= 10; i++) expect(plannedStandard(String(i))).toBe(i);
  });
});
