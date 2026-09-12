import { describe, expect, it } from 'vitest';
import {
  BALL_RADIUS,
  CENTER_MARK_LENGTH,
  COURT_LINE_WIDTH,
  DOUBLES_HALF_WIDTH,
  HALF_LENGTH,
  NET_TAPE_WIDTH,
  SERVICE_LINE_DISTANCE,
  SINGLES_HALF_WIDTH,
  centerMarkCenterZ,
  centerMarkWidthX,
  centerMarkZRange,
  isInBounds,
  netHeightAt,
  netTapeVerticalRange,
} from './court';

describe('court constants', () => {
  it('uses exact ITF dimensions in metres', () => {
    expect(HALF_LENGTH).toBe(11.885);
    expect(SINGLES_HALF_WIDTH).toBe(4.115);
    expect(DOUBLES_HALF_WIDTH).toBe(5.485);
    expect(SERVICE_LINE_DISTANCE).toBe(6.4);
    expect(BALL_RADIUS).toBe(0.0335);
  });
});

describe('netHeightAt', () => {
  it('returns centre strap height at the net mid-point', () => {
    expect(netHeightAt(0)).toBe(0.914);
  });

  it('returns post height at doubles sidelines', () => {
    expect(netHeightAt(5.485)).toBe(1.07);
    expect(netHeightAt(-5.485)).toBe(1.07);
  });

  it('is symmetric about the net centre', () => {
    expect(netHeightAt(2.5)).toBeCloseTo(netHeightAt(-2.5), 10);
  });

  it('clamps to post height beyond the doubles posts', () => {
    expect(netHeightAt(6)).toBe(1.07);
    expect(netHeightAt(-7)).toBe(1.07);
  });
});

describe('isInBounds', () => {
  const EPS = 1e-6;

  it('defaults to singles court boundaries', () => {
    expect(isInBounds(0, 0)).toBe(true);
    expect(isInBounds(SINGLES_HALF_WIDTH, HALF_LENGTH)).toBe(true);
    expect(isInBounds(-SINGLES_HALF_WIDTH, -HALF_LENGTH)).toBe(true);
  });

  it('includes points on the singles sidelines and baselines', () => {
    expect(isInBounds(SINGLES_HALF_WIDTH, 0)).toBe(true);
    expect(isInBounds(-SINGLES_HALF_WIDTH, 0)).toBe(true);
    expect(isInBounds(0, HALF_LENGTH)).toBe(true);
    expect(isInBounds(0, -HALF_LENGTH)).toBe(true);
  });

  it('rejects points just outside singles sidelines and baselines', () => {
    expect(isInBounds(SINGLES_HALF_WIDTH + EPS, 0)).toBe(false);
    expect(isInBounds(-SINGLES_HALF_WIDTH - EPS, 0)).toBe(false);
    expect(isInBounds(0, HALF_LENGTH + EPS)).toBe(false);
    expect(isInBounds(0, -HALF_LENGTH - EPS)).toBe(false);
  });

  it('supports doubles when explicitly requested', () => {
    expect(isInBounds(DOUBLES_HALF_WIDTH, HALF_LENGTH, { court: 'doubles' })).toBe(true);
    expect(isInBounds(-DOUBLES_HALF_WIDTH, -HALF_LENGTH, { court: 'doubles' })).toBe(true);
    expect(isInBounds(DOUBLES_HALF_WIDTH + EPS, 0, { court: 'doubles' })).toBe(false);
    expect(isInBounds(SINGLES_HALF_WIDTH + EPS, 0, { court: 'doubles' })).toBe(true);
  });
});

describe('center mark geometry', () => {
  it('uses a 10cm mark length along Z', () => {
    expect(CENTER_MARK_LENGTH).toBe(0.1);
  });

  it('centers the near mark inward from the baseline', () => {
    expect(centerMarkCenterZ('near')).toBe(-HALF_LENGTH + CENTER_MARK_LENGTH / 2);
  });

  it('centers the far mark inward from the baseline', () => {
    expect(centerMarkCenterZ('far')).toBe(HALF_LENGTH - CENTER_MARK_LENGTH / 2);
  });

  it('extends each mark along Z into the court from its baseline', () => {
    expect(centerMarkZRange('near')).toEqual([
      -HALF_LENGTH,
      -HALF_LENGTH + CENTER_MARK_LENGTH,
    ]);
    expect(centerMarkZRange('far')).toEqual([
      HALF_LENGTH - CENTER_MARK_LENGTH,
      HALF_LENGTH,
    ]);
  });

  it('uses line width along X', () => {
    expect(centerMarkWidthX()).toBe(COURT_LINE_WIDTH);
  });
});

describe('net tape geometry', () => {
  it('uses regulation tape width', () => {
    expect(NET_TAPE_WIDTH).toBe(0.05);
  });

  it('aligns the tape top edge with net height at x', () => {
    expect(netTapeVerticalRange(0).topY).toBe(netHeightAt(0));
    expect(netTapeVerticalRange(5.485).topY).toBe(1.07);
    expect(netTapeVerticalRange(-5.485).topY).toBe(1.07);
  });

  it('builds tape downward from the net top without exceeding it', () => {
    const range = netTapeVerticalRange(0);
    expect(range.bottomY).toBeCloseTo(range.topY - NET_TAPE_WIDTH, 10);
    expect(range.bottomY).toBeLessThan(range.topY);
  });

  it('is symmetric about the net centre', () => {
    expect(netTapeVerticalRange(2.5).topY).toBeCloseTo(netTapeVerticalRange(-2.5).topY, 10);
    expect(netTapeVerticalRange(2.5).bottomY).toBeCloseTo(netTapeVerticalRange(-2.5).bottomY, 10);
  });
});
