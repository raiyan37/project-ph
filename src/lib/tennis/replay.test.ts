import { describe, expect, it } from 'vitest';
import { getCompiledTennisMatch } from '../../data/tennis/match';
import {
  replayCameraForOutcome,
  replayMeasurement,
  replayTrail,
  nearestSinglesBoundary,
} from './replay';
import { SINGLES_HALF_WIDTH } from './court';

const compiled = getCompiledTennisMatch();

describe('replayCameraForOutcome', () => {
  it('picks a net-height side-on camera for tape calls', () => {
    expect(replayCameraForOutcome('net').id).toBe('net-side');
    expect(replayCameraForOutcome('net').position[1]).toBeCloseTo(1.07, 2);
  });

  it('uses overhead plus a down-the-line option for line calls', () => {
    expect(replayCameraForOutcome('out').id).toBe('overhead');
    expect(replayCameraForOutcome('winner').id).toBe('down-the-line');
  });
});

describe('replayMeasurement', () => {
  it('reports tape clearance for a netted ball', () => {
    const compiledPoint = compiled.points[1]!;
    const measurement = replayMeasurement(compiledPoint);

    expect(measurement.kind).toBe('net-clearance');
    expect(measurement.valueMeters).toBeLessThan(0);
    expect(measurement.display).toMatch(/tape/i);
    expect(measurement.display).toMatch(/cm/i);
  });

  it('reports the signed line margin for a ball that lands out', () => {
    const compiledPoint = compiled.points[2]!;
    const measurement = replayMeasurement(compiledPoint);

    expect(measurement.kind).toBe('in-out');
    expect(measurement.inBounds).toBe(false);
    expect(measurement.valueMeters).toBeLessThan(0);
    expect(measurement.display).toMatch(/out/i);
  });

  it('reports a winner as in by centimetres', () => {
    const compiledPoint = compiled.points[0]!;
    const measurement = replayMeasurement(compiledPoint);

    expect(measurement.kind).toBe('in-out');
    expect(measurement.inBounds).toBe(true);
    expect(measurement.valueMeters).toBeGreaterThan(0);
    expect(measurement.display).toMatch(/in/i);
  });
});

describe('replayTrail', () => {
  it('returns samples of the decisive shot up to the given time', () => {
    const compiledPoint = compiled.points[0]!;
    const trajectory =
      compiledPoint.trajectories[compiledPoint.point.decisiveShotIndex]!;
    const mid =
      trajectory.shot.t + (trajectory.bounces[0]!.t - trajectory.shot.t) / 2;
    const trail = replayTrail(compiledPoint, mid);

    expect(trail.length).toBeGreaterThan(2);
    expect(trail[0]).toEqual(trajectory.shot.from);
    expect(trail.at(-1)![1]).toBeGreaterThan(0);
  });
});

describe('nearestSinglesBoundary', () => {
  it('measures perpendicular distance to the nearest singles line', () => {
    const sideline = nearestSinglesBoundary(SINGLES_HALF_WIDTH + 0.04, 0);
    expect(sideline.axis).toBe('x');
    expect(sideline.distance).toBeCloseTo(0.04, 5);

    const baseline = nearestSinglesBoundary(0, 11.885 + 0.05);
    expect(baseline.axis).toBe('z');
    expect(baseline.distance).toBeCloseTo(0.05, 5);
  });
});
