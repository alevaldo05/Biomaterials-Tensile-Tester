/* What the person enters before a test, and the checks on it. Nothing is prefilled. */
import type { Specimen, TestParams, TestType } from '@tensile/core';

export interface Setup {
  material: string; specimenId: string; temperature: string; environment: string; notes: string;
  L0: string; width: string; thickness: string;
  speed: string; holdMm: string; holdS: string;
  offsetOn: boolean; offsetPct: string;
}
export const EMPTY_SETUP: Setup = { material: '', specimenId: '', temperature: '', environment: '', notes: '', L0: '', width: '', thickness: '', speed: '', holdMm: '', holdS: '', offsetOn: false, offsetPct: '' };
export const EXAMPLE_DIMENSIONS = { L0: '25', width: '5', thickness: '1.2' };
export const EXAMPLE_SETTINGS: Record<TestType, Partial<Setup>> = { uniaxial: { speed: '30' }, relaxation: { speed: '30', holdMm: '2.5', holdS: '60' } };
export const MATERIAL_CHOICES = ['Rabbit tissue', 'Test'];

export function num(v: string): number | null {
  const x = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(x) ? x : null;
}
function positive(v: string, name: string): string | undefined {
  const x = num(v);
  return v.trim() === '' ? 'Enter the ' + name + '.' : x === null || !(x > 0) ? 'The ' + name + ' must be a number above 0.' : undefined;
}

export type Problems = Partial<Record<keyof Setup, string>>;
export function setupProblems(s: Setup, test: TestType): Problems {
  const p: Problems = {};
  if (!s.material.trim()) p.material = 'Enter the material.';
  const set = (k: keyof Setup, m: string | undefined) => { if (m) p[k] = m; };
  set('L0', positive(s.L0, 'gauge length')); set('width', positive(s.width, 'width')); set('thickness', positive(s.thickness, 'thickness'));
  set('speed', positive(s.speed, 'crosshead speed'));
  if (test === 'relaxation') { set('holdMm', positive(s.holdMm, 'hold displacement')); set('holdS', positive(s.holdS, 'hold duration')); }
  if (test === 'uniaxial' && s.offsetOn) {
    const o = num(s.offsetPct);
    if (o === null || o < 0.05 || o > 5) p.offsetPct = 'Enter an offset from 0.05 to 5 % strain.';
  }
  return p;
}
export const STEP_FIELDS: Record<'specimen' | 'dimensions' | 'settings', (keyof Setup)[]> = {
  specimen: ['material'], dimensions: ['L0', 'width', 'thickness'], settings: ['speed', 'holdMm', 'holdS', 'offsetPct'],
};

/** The specimen and test parameters the calculations use, from what was typed. */
export function paramsFrom(s: Setup, test: TestType): { specimen: Specimen; params: Partial<TestParams> } {
  return {
    specimen: { L0_mm: num(s.L0) ?? 0, width_mm: num(s.width) ?? 0, thickness_mm: num(s.thickness) ?? 0 },
    params: { speed_mm_min: num(s.speed) ?? '', yield: false,
      ...(test === 'relaxation' ? { hold_mm: num(s.holdMm) ?? 0, hold_s: num(s.holdS) ?? 0, holdSource: 'typed' as const } : {}),
      ...(test === 'uniaxial' && s.offsetOn && num(s.offsetPct) ? { offsetPct: num(s.offsetPct) as number } : {}) },
  };
}
