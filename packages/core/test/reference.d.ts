/* Types for the plain .mjs reference files, so the tests can import them. */
declare module '*/reference/cases.mjs' {
  export const CAL_CASES: Record<string, { s: { unit: 'g' | 'kg'; g: number | null; tol: number | null }; rows: { m: string; r: string }[] }>;
  export const STATS_CASES: number[][];
  export const SPEC: { mat: string; matLabel: string; id: string; temp: string; env: string; notes: string };
  export const STARTED: [number, number, number, number, number, number];
  export function syntheticUniaxial(): unknown;
  export function syntheticRelaxation(): unknown;
  export function csvVariants(): unknown;
}
declare module '*/reference/legacy.mjs' {
  export function loadLegacy(): { SAMPLE_DATA: unknown };
}
declare module '*/reference/calibration-csv.mjs' {
  export function legacyCalibrationCsv(
    settings: { unit: 'g' | 'kg'; g: number | null; tol: number | null; cell: string; notes: string },
    rows: { m: string; r: string }[],
    example: boolean,
    dateParts: number[],
  ): { text: string; fileName: string };
}
declare module '*/reference/xlsx-reference.mjs' {
  import type { XlsxCompareInfo, XlsxInfo } from '../src/xlsx';
  export const XLSX_DATE_PARTS: number[];
  export const XLSX_INFO: XlsxInfo;
  export const XLSX_COMPARE_INFO: XlsxCompareInfo;
  export function buildXlsxReference(): { single: string; compare: string };
}
