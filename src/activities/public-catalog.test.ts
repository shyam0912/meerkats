import { COUNTING } from '../../contracts/counting-content';
import { expect, test } from 'vitest';
import { DEMO } from '../../contracts/demo';
import { bundledCatalog as internal, bundledVersions as published } from '../../contracts/catalog-content';
import { CHEMISTRY } from '../../contracts/chemistry';
import { PHYSICS } from '../../contracts/physics';
import { bundledCatalog, bundledVersions } from './public-catalog';

test('the public catalog keeps all three approved previews and excludes the engineering fixture', () => {
  expect(bundledCatalog.nodes).toEqual(internal.nodes.filter(node => !Object.values<string>(DEMO).includes(node.id)));
  expect(bundledCatalog.lessons).toEqual(internal.lessons.filter(lesson => lesson.id !== DEMO.lesson));
  expect(bundledVersions.map(v => v.id)).toEqual([CHEMISTRY.version, PHYSICS.version, COUNTING.version]);
});

test('Standard 1 remains an original demo concept with teacher review pending', () => {
  const version = bundledVersions.find(v => v.id === COUNTING.version)!;
  expect(version.provenance.sourceType).toBe('original-demo');
  expect(version.provenance.reviewStatus).toBe('teacher-review-pending');
  expect(version.provenance.note).toBe('Original Demo Concept — Preview / Teacher Review Pending. Not an official SCERT chapter.');
});

test('only the Chemistry authoring note differs from the pinned development payloads', () => {
  for (const version of bundledVersions) {
    const original = published.find(v => v.id === version.id)!;
    expect(version.provenance.reviewStatus).toBe('teacher-review-pending');
    if (version.id === CHEMISTRY.version) {
      expect(original.provenance.note).toContain('10_Chemistry Eng.pdf');
      expect({ ...version, provenance: { ...version.provenance, note: original.provenance.note } }).toEqual(original);
    } else {
      expect(version).toEqual(original);
    }
  }
});
