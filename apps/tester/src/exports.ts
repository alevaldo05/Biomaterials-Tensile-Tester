/* Files the person can save. Everything is built in the browser tab and handed to the browser's own download;
   nothing is uploaded. Numbers stay in base units (N, mm, s, MPa). */
import { buildTestCsv, buildXlsx, csvCell, csvFileBase, dataChecks, dimSourceText, modulusFitText, sig, sourceTag } from '@tensile/core';
import type { CsvContext, TestRecord, TestType, XlsxInfo } from '@tensile/core';
import type { Session } from '@tensile/recording';
import type { TestController } from './controller';
import { resultsFor } from './results';

export function save(name: string, parts: BlobPart[], type: string): void {
  const url = URL.createObjectURL(new Blob(parts, { type })), a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const KIND = { uniaxial: { slug: 'uniaxial-tension', name: 'Uniaxial tension' }, relaxation: { slug: 'stress-relaxation', name: 'Stress relaxation' } };

export function csvContext(c: TestController): CsvContext {
  const s = c.setup;
  return {
    spec: { mat: s.material, matLabel: s.material, id: s.specimenId, temp: s.temperature, env: s.environment, notes: s.notes },
    kind: KIND[c.test], isRelax: c.test === 'relaxation', startedAt: c.startedAt, endReason: c.session ? c.session.endReason : '',
    checks: {},   /* the website's force-drop check does not apply: this app sends no stop command */
  };
}
/** The record as the files label it: a replay of simulated data is still simulated. */
function labeled(rec: TestRecord): TestRecord {
  return rec.source === 'loaded' && rec.simulated ? { ...rec, source: 'simulated' } : rec.source === 'loaded' ? { ...rec, source: 'measured' } : rec;
}
export function fileBase(c: TestController): string {
  const rec = c.record;
  if (rec) return csvFileBase(labeled(rec), csvContext(c));
  return csvFileBase({ source: 'measured' }, csvContext(c));
}

export function testCsv(c: TestController): string | null {
  return c.record ? buildTestCsv(labeled(c.record), csvContext(c)) : null;
}

export function testXlsx(c: TestController): Uint8Array | null {
  const r = c.record;
  if (!r || !r.raw) return null;
  const isRelax = c.test === 'relaxation', sp = r.params.specimen, tag = sourceTag(labeled(r)), s = c.setup;
  const details: XlsxInfo['details'] = [
    ['Biomaterials Tensile Tester', 'test data'], ['Test', KIND[c.test].name], ['Source', tag], ['Material', s.material], ['Specimen ID', s.specimenId],
    ['Gauge length L0 (mm)', sp.L0_mm], ['Width (mm)', sp.width_mm], ['Thickness (mm)', sp.thickness_mm], ['Area A0 (mm2)', Number(sig(sp.width_mm * sp.thickness_mm, 6))],
    ['Crosshead speed set on the tester (mm/min)', s.speed],
  ];
  if (isRelax) details.push(['Hold displacement (mm)', s.holdMm], ['Hold duration (s)', s.holdS]);
  if (s.temperature) details.push(['Temperature (C)', s.temperature]);
  if (s.environment) details.push(['Environment', s.environment]);
  if (s.notes) details.push(['Notes', s.notes]);
  details.push(['End of test', c.session ? c.session.endReason : ''], ['Points', r.x.length]);
  const mft = isRelax ? '' : modulusFitText(r);
  if (mft) details.push(['Modulus fit interval', mft]);
  details.push(['Dimensions source', dimSourceText(r)]);
  const dq = dataChecks(r, isRelax, {});
  if (dq.text) details.push(['Data checks', dq.text]);
  for (const [k, v] of sessionDetails(c)) details.push([k, v]);
  const columns: XlsxInfo['columns'] = [{ name: 'time_s', values: r.raw.t ?? [] }, { name: 'force_N', values: r.raw.F }, { name: 'displacement_mm', values: r.raw.d ?? [] }];
  if (!isRelax) columns.push({ name: 'strain', values: r.x });
  columns.push({ name: 'stress_MPa', values: r.y });
  return buildXlsx({
    details, results: resultsFor(r).rows.map((q) => [q.name, q.value, q.note]), columns,
    chart: { title: KIND[c.test].name + ' (' + tag + ')', xName: isRelax ? 'time_s' : 'strain', yName: 'stress_MPa',
      xTitle: isRelax ? 'Time (s)' : 'Crosshead-based engineering strain, Δx/L₀ (mm/mm)', yTitle: isRelax ? 'Stress (MPa)' : 'Engineering stress, F/A₀ (MPa)', seriesName: tag || 'Stress' },
    note: 'Stress and strain are calculated from the recorded values. Displacement is crosshead displacement, not an extensometer measurement. Force and displacement are converted one after another by the ADC; each force sample is paired with the displacement interpolated to the same device time.',
  });
}

/** Where the data came from and how it was converted, as label and value pairs. */
export function sessionDetails(c: TestController): [string, string][] {
  const s = c.session;
  if (!s) return [];
  const settings = Object.values(s.settings), out: [string, string][] = [
    ['Data', c.dataLabel],
    ['Device', s.identity.deviceType + ' · ' + s.identity.deviceId + ' · software ' + s.identity.softwareVersion],
    ['Protocol', s.identity.protocol], ['App version', s.appVersion],
    ['ADC settings', settings.map((x) => x.adc + ', ±' + x.fullScale_mV + ' mV, ' + x.dataRate_sps + ' conversions/s, order ' + x.channelOrder.join(' then ') + ' (' + x.ref + ')').join('; ')],
    ['Achieved rate', c.rate === null ? '' : sig(c.rate, 4) + ' samples/s per channel'],
    ['Device profile', s.profileId ?? 'none'],
    ['Force calibration', s.calibrations.force ? s.calibrations.force.id + ' (' + s.calibrations.force.origin + ')' : 'none: uncalibrated'],
    ['Displacement calibration', s.calibrations.displacement ? s.calibrations.displacement.id + ' (' + s.calibrations.displacement.origin + ')' : 'none: uncalibrated'],
    ['Force zero (software, not a calibration)', sig(s.forceZero_N, 4) + ' N'],
    ['Missing samples', String(s.missingSamples)],
    ['Interrupted', s.interrupted ? 'yes' : 'no'],
  ];
  if (s.events.length) out.push(['Events', s.events.map((e) => e.kind + ': ' + e.detail).join(' | ')]);
  return out;
}

/** Every sample as recorded: counts, both timestamps, volts, and the value when calibrated (empty when not). */
export function samplesCsv(c: TestController, session: Session): string {
  const out = ['# Biomaterials Tensile Tester,raw samples', '# Data,' + csvCell(c.dataLabel)];
  for (const [k, v] of sessionDetails(c)) out.push('# ' + k + ',' + csvCell(v));
  out.push('channel,quantity,seq,device_time_s,received_ms,raw_counts,settings_ref,volts_adc,volts_signal,value,unit,quality');
  const n = (v: number) => (Number.isFinite(v) ? String(v) : '');
  for (const col of Object.values(session.columns)) {
    for (let i = 0; i < col.raw.length; i++) {
      out.push([col.channelId, col.quantity, col.seq[i], n(col.deviceTime_s[i] as number), col.receivedAt_ms[i], col.raw[i], col.settingsRef[i], n(col.volts_adc[i] as number), n(col.volts_signal[i] as number), n(col.value[i] as number), col.unit ?? '', (col.quality[i] ?? []).join(' ')].join(','));
    }
  }
  return '﻿' + out.join('\r\n') + '\r\n';
}

export function svgText(svg: SVGSVGElement): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
}
export function svgToPng(svg: SVGSVGElement, scale = 3): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(new Blob([svgText(svg)], { type: 'image/svg+xml' }));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 720 * scale; canvas.height = 420 * scale;
      const g = canvas.getContext('2d');
      if (!g) { reject(new Error('The picture could not be drawn.')); return; }
      g.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The picture could not be made.'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('The picture could not be made.')); };
    img.src = url;
  });
}

/** Excel for a test opened in Load test. */
export function xlsxForRecord(r: TestRecord, test: TestType, name: string, provenance: string): Uint8Array {
  const isRelax = test === 'relaxation', sp = r.params.specimen, tag = 'Loaded from ' + name;
  const details: XlsxInfo['details'] = [['Biomaterials Tensile Tester', 'test data'], ['Test', isRelax ? 'Stress relaxation' : 'Uniaxial tension'], ['Source', provenance],
    ['Gauge length L0 (mm)', sp.L0_mm], ['Width (mm)', sp.width_mm], ['Thickness (mm)', sp.thickness_mm], ['Points', r.x.length]];
  const mft = isRelax ? '' : modulusFitText(r);
  if (mft) details.push(['Modulus fit interval', mft]);
  const columns: XlsxInfo['columns'] = [];
  if (r.raw?.t) columns.push({ name: 'time_s', values: r.raw.t });
  if (r.raw?.F) columns.push({ name: 'force_N', values: r.raw.F });
  if (r.raw?.d) columns.push({ name: 'displacement_mm', values: r.raw.d });
  if (!isRelax) columns.push({ name: 'strain', values: r.x });
  columns.push({ name: 'stress_MPa', values: r.y });
  return buildXlsx({ details, results: resultsFor(r).rows.map((q) => [q.name, q.value, q.note]), columns,
    chart: { title: (isRelax ? 'Stress relaxation' : 'Uniaxial tension') + ' (' + tag + ')', xName: isRelax ? 'time_s' : 'strain', yName: 'stress_MPa',
      xTitle: isRelax ? 'Time (s)' : 'Crosshead-based engineering strain, Δx/L₀ (mm/mm)', yTitle: isRelax ? 'Stress (MPa)' : 'Engineering stress, F/A₀ (MPa)', seriesName: tag },
    note: 'Stress and strain are calculated from the file. Displacement is crosshead displacement, not an extensometer measurement.' });
}
