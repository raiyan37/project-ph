import { describe, expect, it } from 'vitest';
import { getCompiledTennisMatch, SCRIPTED_POINTS } from '../../data/tennis/match';
import { getMatchSnapshot, pointEndedBetween } from './matchState';

const compiled = getCompiledTennisMatch();

describe('getMatchSnapshot', () => {
  it('reports no current point between rallies', () => {
    const snapshot = getMatchSnapshot(20, compiled);

    expect(snapshot.currentPoint).toBeUndefined();
    expect(snapshot.completedPointCount).toBe(1);
    expect(snapshot.score.far).toBe(15);
  });

  it('tracks the live point and score during a rally', () => {
    const snapshot = getMatchSnapshot(SCRIPTED_POINTS[2]!.startT + 0.4, compiled);

    expect(snapshot.currentPoint?.point).toBe(SCRIPTED_POINTS[2]);
    expect(snapshot.completedPointCount).toBe(2);
    expect(snapshot.score).toMatchObject({ near: 0, far: 30 });
  });

  it('counts a point complete at its authored end time', () => {
    const snapshot = getMatchSnapshot(SCRIPTED_POINTS[0]!.endT, compiled);

    expect(snapshot.currentPoint).toBeUndefined();
    expect(snapshot.completedPointCount).toBe(1);
  });
});

describe('pointEndedBetween', () => {
  it('fires when the clock crosses a point end', () => {
    const ended = pointEndedBetween(17.9, 18.05, compiled);

    expect(ended?.point.id).toBe('point-01');
  });

  it('does not fire while still inside the point window', () => {
    expect(pointEndedBetween(17.2, 17.8, compiled)).toBeUndefined();
  });

  it('ignores seeks that jump more than a second', () => {
    expect(pointEndedBetween(10, 40, compiled)).toBeUndefined();
  });

  it('rejects non-finite media times', () => {
    expect(() => pointEndedBetween(Number.NaN, 1, compiled)).toThrow(/finite/i);
  });
});
