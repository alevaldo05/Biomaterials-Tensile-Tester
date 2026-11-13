import { describe, expect, it } from 'vitest';
import { XLSX_COMPARE_INFO, XLSX_DATE_PARTS, XLSX_INFO, buildXlsxReference } from '../reference/xlsx-reference.mjs';
import saved from '../reference/fixtures/xlsx-reference.json';
import { buildCompareXlsx, buildXlsx } from '../src/xlsx';

const ALPHABET: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = ((b[i] ?? 0) << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += ALPHABET.charAt((n >> 18) & 63) + ALPHABET.charAt((n >> 12) & 63) + (i + 1 < b.length ? ALPHABET.charAt((n >> 6) & 63) : '=') + (i + 2 < b.length ? ALPHABET.charAt(n & 63) : '=');
  }
  return out;
}
const date = new Date(...(XLSX_DATE_PARTS as [number, number, number, number, number, number]));

describe('.xlsx files', () => {
  it('excel-export.js still gives the saved bytes', () => {
    expect(buildXlsxReference()).toEqual(saved);
  });
  it('the port gives the same bytes: test data workbook', () => {
    expect(b64(buildXlsx(XLSX_INFO, date))).toBe(saved.single);
  });
  it('the port gives the same bytes: comparison workbook', () => {
    expect(b64(buildCompareXlsx(XLSX_COMPARE_INFO, date))).toBe(saved.compare);
  });
});
