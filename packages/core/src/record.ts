/* Test records. Internal units: force N, displacement mm, time s, stress MPa (N/mm2), strain as a ratio,
   energy MJ/m3. A record keeps the raw force and displacement so stress and strain can be rebuilt when
   the dimensions change. */

export type TestType = 'uniaxial' | 'relaxation';
/** Where the data came from. Simulated and sample data are never presented as measured. */
export type DataSource = 'none' | 'sample' | 'simulated' | 'measured' | 'loaded';
export type DimSource = 'typed' | 'example' | 'file' | 'file-example' | 'assumed' | 'edited' | 'not-needed';

export interface Specimen { L0_mm: number; width_mm: number; thickness_mm: number }

export interface TestParams {
  specimen: Specimen;
  /** The 0.2% offset yield from the origin, used only for ductile sample materials. */
  yield?: boolean;
  /** Opt-in offset yield, in % strain, measured from the fitted line's own intercept. */
  offsetPct?: number;
  hold_mm?: number;
  hold_s?: number;
  hold_strain?: number;
  holdSource?: 'header' | 'median' | 'median-strain' | 'edited' | 'typed';
  speed_mm_min?: number | string;
  rate_per_s?: number | string;
  preload_N?: number | string;
  temperature_C?: number | string;
  environment?: string;
  model?: string;
}

export interface RawData { t?: number[]; d?: number[]; F: number[] }

export interface TestRecord {
  id?: string;
  test: TestType;
  source: DataSource;
  params: TestParams;
  raw?: RawData;
  /** Strain (uniaxial) or time in s (relaxation). */
  x: number[];
  /** Stress in MPa. */
  y: number[];
  material?: string;
  /** Which region naming to use on the graph: 'biomaterial', 'steel', 'concrete', or 'plain'. */
  mk?: string | null;
  region?: string;
  label?: string;
  units?: { x: string; y: string };
  /** True when stress and strain came straight from a file, so dimensions are not needed. */
  direct?: boolean;
  simulated?: boolean;
  fileName?: string;
  dimSource?: DimSource;
  dimSourceBase?: DimSource;
  dimsFromFile?: boolean;
  base?: TestParams;
  baseLabel?: string;
  specimenId?: string;
  materialText?: string;
  fileDate?: string;
  fileMeta?: [string, string][];
  /** Times kept from a uniaxial file only so the data checks can look at them. */
  checkT?: number[];
  skippedLines?: number;
}

export function clone<T>(o: T): T { return JSON.parse(JSON.stringify(o)) as T; }

export function area(p: TestParams): number { return p.specimen.width_mm * p.specimen.thickness_mm; }

/** Turns a sample curve (strain or time against stress) into raw force and displacement using its example dimensions. */
export function initSample(r: TestRecord, isRelax: boolean): void {
  const p = r.params, A0 = area(p), L0 = p.specimen.L0_mm;
  if (isRelax) {
    p.hold_mm = (p.hold_strain as number) * L0;
    r.raw = { t: r.x.slice(), F: r.y.map((v) => v * A0) };
  } else {
    r.raw = { d: r.x.map((v) => v * L0), F: r.y.map((v) => v * A0) };
  }
  r.base = clone(p);
  r.baseLabel = 'Example dimensions';
}

/** Rebuilds stress and strain (or time) from the raw arrays and the current dimensions. */
export function recompute(r: TestRecord, isRelax: boolean): void {
  if (!r.raw) return;
  const p = r.params, A0 = area(p), L0 = p.specimen.L0_mm;
  r.y = r.raw.F.map((F) => F / A0);
  if (isRelax) { r.x = r.raw.t as number[]; p.hold_strain = (p.hold_mm as number) / L0; }
  else r.x = (r.raw.d as number[]).map((d) => d / L0);
}

export function sourceTag(r: Pick<TestRecord, 'source' | 'fileName' | 'simulated'>): string {
  if (r.source === 'sample') return 'Sample data, not measured';
  if (r.source === 'simulated') return 'Simulated data, not measured';
  if (r.source === 'measured') return 'Measured data';
  if (r.source === 'loaded') return 'Loaded file: ' + r.fileName + (r.simulated ? ' (declared simulated, not measured)' : ' (data origin not verified)');
  return '';
}

const DIM_TEXT: Record<DimSource, string> = {
  typed: 'typed by the user',
  example: 'example values (not measured)',
  file: 'read from the file',
  'file-example': 'example values, as declared in the file (not measured)',
  assumed: 'example values assumed because the file had none (not measured)',
  edited: 'entered on this page',
  'not-needed': 'not needed (stress and strain given)',
};
/** Where the specimen dimensions came from (labeling only; no calculation depends on it). */
export function dimSourceText(r: Pick<TestRecord, 'dimSource'> | null | undefined): string {
  return r && r.dimSource ? DIM_TEXT[r.dimSource] || '' : '';
}
export function dimIsExample(r: Pick<TestRecord, 'dimSource'> | null | undefined): boolean {
  return !!r && (r.dimSource === 'example' || r.dimSource === 'file-example' || r.dimSource === 'assumed');
}
