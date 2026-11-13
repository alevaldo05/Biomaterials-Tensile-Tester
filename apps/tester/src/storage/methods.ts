/* Test methods: saved setups to start a test from. A method never holds a specimen's identity or results.
   Changing a method makes a new revision; a recorded test keeps the revision it was started from. */
import type { TestType } from '@tensile/core';
import type { Setup } from '../setup';

/** The parts of a setup a method carries. Specimen ID and notes stay with each specimen. */
export type MethodFields = Omit<Setup, 'specimenId' | 'notes'>;

export interface TestMethod {
  id: string;
  name: string;
  revision: number;
  test: TestType;
  fields: MethodFields;
  instructions: string;
  archived: boolean;
  createdAt: string;
}

export function methodFromSetup(name: string, test: TestType, setup: Setup, instructions = ''): Omit<TestMethod, 'id' | 'revision' | 'createdAt' | 'archived'> {
  const { specimenId: _s, notes: _n, ...fields } = setup;
  return { name: name.trim(), test, fields, instructions };
}
/** A setup for a new specimen from a method: the method's fields, a blank specimen ID and notes. */
export function setupFromMethod(m: TestMethod): Setup {
  return { ...m.fields, specimenId: '', notes: '' };
}

export interface MethodStore {
  list(): Promise<TestMethod[]>;
  save(m: Omit<TestMethod, 'id' | 'revision' | 'createdAt' | 'archived'>, replaces?: TestMethod): Promise<TestMethod>;
  archive(id: string): Promise<void>;
}

/** Methods shared through the lab server. Only admins can save or archive; the server checks. */
export class LabMethods implements MethodStore {
  constructor(private readonly api: { methods: () => Promise<TestMethod[]>; saveMethod: MethodStore['save']; archiveMethod: (key: string) => Promise<void> }) {}
  list(): Promise<TestMethod[]> { return this.api.methods(); }
  save(m: Omit<TestMethod, 'id' | 'revision' | 'createdAt' | 'archived'>, replaces?: TestMethod): Promise<TestMethod> {
    if (!m.name) return Promise.reject(new Error('Give the method a name.'));
    return this.api.saveMethod(m, replaces);
  }
  archive(id: string): Promise<void> { return this.api.archiveMethod(id); }
}

const newId = () => 'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);

export class MemoryMethods implements MethodStore {
  private items: TestMethod[] = [];
  async list(): Promise<TestMethod[]> { return this.items.filter((m) => !m.archived).map((m) => ({ ...m })); }
  async save(m: Omit<TestMethod, 'id' | 'revision' | 'createdAt' | 'archived'>, replaces?: TestMethod): Promise<TestMethod> {
    if (!m.name) throw new Error('Give the method a name.');
    if (replaces) { const old = this.items.find((x) => x.id === replaces.id); if (old) old.archived = true; }
    const item: TestMethod = { ...m, id: newId(), revision: replaces ? replaces.revision + 1 : 1, createdAt: new Date().toISOString(), archived: false };
    this.items.push(item);
    return { ...item };
  }
  async archive(id: string): Promise<void> { const m = this.items.find((x) => x.id === id); if (m) m.archived = true; }
}
