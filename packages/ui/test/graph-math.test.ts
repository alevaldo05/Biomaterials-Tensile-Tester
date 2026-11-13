import { describe, expect, it } from 'vitest';
import { autoscaleY, fullView, nearestIndex, roundUp, snapTo, thin, ticksFor, toData, toPx, zoomAt } from '../src/graph-math';

const box = { left: 50, top: 10, width: 600, height: 300 };

describe('graph arithmetic', () => {
  it('rounds the axis end up to a round number', () => {
    expect([0.33, 1.2, 7.4, 44.4, 0].map(roundUp)).toEqual([0.5, 1.5, 7.5, 50, 1]);
  });
  it('maps data to the screen and back', () => {
    const v = { x0: 0, x1: 10, y0: 0, y1: 5 };
    expect(toPx({ x: 5, y: 2.5 }, v, box)).toEqual({ x: 350, y: 160 });
    const back = toData(toPx({ x: 3.3, y: 1.1 }, v, box), v, box);
    expect(back.x).toBeCloseTo(3.3, 12); expect(back.y).toBeCloseTo(1.1, 12);
  });
  it('shows all data from zero, and autoscale fits y to the visible x range', () => {
    const x = [0, 1, 2, 3, 4], y = [0, 2, 9, 3, 1];
    expect(fullView(x, y)).toEqual({ x0: 0, x1: 5, y0: 0, y1: 10 });
    const a = autoscaleY(x, y, { x0: 2.5, x1: 4, y0: 0, y1: 10 });
    expect(a.y1).toBeCloseTo(3 + 2 * 0.08, 12);
    expect(a.x0).toBe(2.5);
  });
  it('zooms about the cursor and limits one step to between half and double', () => {
    const v = zoomAt({ x0: 0, x1: 10, y0: 0, y1: 10 }, 0.5, 0.5, 0.1);
    expect(v).toEqual({ x0: 2.5, x1: 7.5, y0: 2.5, y1: 7.5 });
  });
  it('keeps ticks inside the view', () => {
    expect(ticksFor(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });
  it('thins a long curve for drawing but keeps its peak and its drop, and leaves the data alone', () => {
    const n = 100000, x = Array.from({ length: n }, (_, i) => i), y = x.map((i) => (i === 61234 ? 99 : i === 70001 ? -5 : Math.sin(i / 500)));
    const copy = y.slice();
    const idx = thin(x, y, { x0: 0, x1: n, y0: -5, y1: 99 }, 1000);
    expect(idx.length).toBeLessThanOrEqual(2000);
    expect(idx).toContain(61234);
    expect(idx).toContain(70001);
    expect(idx).toEqual(idx.slice().sort((a, b) => a - b));
    expect(y).toEqual(copy);
    expect(thin([0, 1, 2], [0, 1, 2], { x0: 0, x1: 2, y0: 0, y1: 2 })).toEqual([0, 1, 2]);
  });
  it('finds the nearest point and snaps to a key result within 14 px only', () => {
    const v = { x0: 0, x1: 10, y0: 0, y1: 10 }, x = [0, 5, 10], y = [0, 5, 10];
    expect(nearestIndex(x, y, toPx({ x: 5.4, y: 5 }, v, box), v, box)).toBe(1);
    const m = [{ id: 'uts', label: 'UTS', x: 5, y: 5 }], at = toPx({ x: 5, y: 5 }, v, box);
    expect(snapTo(m, { x: at.x + 10, y: at.y + 9 }, v, box)?.id).toBe('uts');
    expect(snapTo(m, { x: at.x + 15, y: at.y }, v, box)).toBeNull();
  });
});

describe('overlay curve styles', () => {
  it('gives 12 different hue and line-style pairs, the same for a slot in both themes', async () => {
    const { seriesStyle, MAX_SERIES, SERIES_LIGHT, SERIES_DARK } = await import('../src/Graph');
    expect(MAX_SERIES).toBe(12);
    const light = Array.from({ length: 12 }, (_, i) => seriesStyle(i, false)), dark = Array.from({ length: 12 }, (_, i) => seriesStyle(i, true));
    expect(new Set(light.map((s) => s.color + '|' + s.dash)).size).toBe(12);
    expect(new Set(dark.map((s) => s.color + '|' + s.dash)).size).toBe(12);
    light.forEach((s, i) => { expect(SERIES_LIGHT.indexOf(s.color as never)).toBe(SERIES_DARK.indexOf(dark[i]!.color as never)); expect(s.dash).toBe(dark[i]!.dash); });
    expect(seriesStyle(0, false)).toEqual({ color: SERIES_LIGHT[0], dash: '' });
  });
});

describe('local slope for the tangent line', () => {
  it('finds the slope of a straight line exactly, and ignores noise between neighbours', async () => {
    const { localSlope } = await import('../src/Graph');
    const x = Array.from({ length: 1000 }, (_, i) => i / 1000), y = x.map((v) => 3 * v + 1);
    expect(localSlope(x, y, 500)).toBeCloseTo(3, 10);
    const noisy = y.map((v, i) => v + (i % 2 ? 0.002 : -0.002));   /* neighbour-to-neighbour slope would be about 3 ± 4 */
    expect(localSlope(x, noisy, 500)!).toBeCloseTo(3, 0);
    expect(Math.abs(localSlope(x, noisy, 500)! - 3)).toBeLessThan(0.5);
    expect(localSlope(x, y, 0)).toBeCloseTo(3, 10);
    expect(localSlope([0, 1], [0, 1], 0)).toBeNull();
    expect(localSlope([1, 1, 1, 1], [0, 1, 2, 3], 1)).toBeNull();
  });
});
