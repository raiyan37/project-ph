import { describe, expect, it } from 'vitest';
import {
  getCompiledTennisMatch,
  type CompiledPoint,
  type CompiledTennisMatch,
} from '../../data/tennis/match';
import type { Vec3 } from './court';
import * as animation from './animation';
import {
  BASELINE_READY_POSITIONS,
  getActivePointAtTime,
  getActiveTrajectoryAtTime,
  getBallPoseAtTime,
  getPlayerPoseAtTime,
  getPointTerminalTime,
  type MatchTimeSource,
} from './animation';

const compiled = getCompiledTennisMatch();

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function decisiveTrajectory(compiledPoint: CompiledPoint) {
  return compiledPoint.trajectories[
    compiledPoint.point.decisiveShotIndex
  ]!;
}

describe('tennis animation timing', () => {
  it('samples mutations from one stable match time source', () => {
    type BallSourceSampler = (
      source: MatchTimeSource,
      match: CompiledTennisMatch,
    ) => ReturnType<typeof getBallPoseAtTime>;
    type PlayerSourceSampler = (
      side: 'near' | 'far',
      source: MatchTimeSource,
      match: CompiledTennisMatch,
    ) => ReturnType<typeof getPlayerPoseAtTime>;

    const sampleBall = Reflect.get(
      animation,
      'getBallPoseFromTimeSource',
    ) as BallSourceSampler | undefined;
    const samplePlayer = Reflect.get(
      animation,
      'getPlayerPoseFromTimeSource',
    ) as PlayerSourceSampler | undefined;

    expect(sampleBall).toBeTypeOf('function');
    expect(samplePlayer).toBeTypeOf('function');
    if (!sampleBall || !samplePlayer) {
      return;
    }

    const firstPoint = compiled.points[0]!.point;
    const mutableSource = { current: firstPoint.startT - 1 };
    const stableSource: MatchTimeSource = mutableSource;
    const beforeBall = sampleBall(stableSource, compiled);
    const beforeNear = samplePlayer('near', stableSource, compiled);

    mutableSource.current = firstPoint.startT;
    const activeBall = sampleBall(stableSource, compiled);
    const activeNear = samplePlayer('near', stableSource, compiled);

    expect(stableSource).toBe(mutableSource);
    expect(beforeBall.visible).toBe(false);
    expect(activeBall.visible).toBe(true);
    expect(beforeNear.active).toBe(false);
    expect(activeNear.active).toBe(true);
    expect(activeBall.position).not.toEqual(beforeBall.position);
  });

  it('uses half-open authored point boundaries', () => {
    const first = compiled.points[0]!;

    expect(
      getActivePointAtTime(first.point.startT - 1e-6, compiled),
    ).toBeUndefined();
    expect(getActivePointAtTime(first.point.startT, compiled)?.compiledPoint).toBe(
      first,
    );
    expect(
      getActivePointAtTime(first.point.endT - 1e-6, compiled)?.compiledPoint,
    ).toBe(first);
    expect(
      getActivePointAtTime(first.point.endT, compiled),
    ).toBeUndefined();
  });

  it('switches trajectories exactly at authored racket contacts', () => {
    const first = compiled.points[0]!;
    const secondContact = first.point.shots[1]!;

    expect(
      getActiveTrajectoryAtTime(secondContact.t - 1e-6, compiled)?.shotIndex,
    ).toBe(0);
    expect(
      getActiveTrajectoryAtTime(secondContact.t, compiled)?.shotIndex,
    ).toBe(1);
    expect(
      getActiveTrajectoryAtTime(secondContact.t, compiled)?.trajectory,
    ).toBe(first.trajectories[1]);
    expect(getBallPoseAtTime(secondContact.t, compiled).position).toEqual(
      secondContact.from,
    );
  });

  it('keeps ball positions continuous across authored trajectory switches', () => {
    compiled.points.forEach(({ point }) => {
      point.shots.slice(1).forEach((shot) => {
        const immediatelyBefore = getBallPoseAtTime(shot.t - 1e-4, compiled);
        const atContact = getBallPoseAtTime(shot.t, compiled);

        expect(immediatelyBefore.visible).toBe(true);
        expect(atContact.visible).toBe(true);
        expect(distance(immediatelyBefore.position, atContact.position)).toBeLessThan(
          0.002,
        );
      });
    });
  });

  it('stops a net outcome at its decisive net crossing', () => {
    const netPoint = compiled.points.find(
      ({ point }) => point.outcome === 'net',
    )!;
    const decisive = decisiveTrajectory(netPoint);
    const crossing = decisive.netCrossing!;
    const terminalTime = getPointTerminalTime(netPoint);
    const atCrossing = getBallPoseAtTime(terminalTime, compiled);
    const heldAfter = getBallPoseAtTime(
      Math.min(netPoint.point.endT - 1e-4, terminalTime + 0.75),
      compiled,
    );

    expect(terminalTime).toBeCloseTo(crossing.t, 12);
    expect(atCrossing.position).toEqual([
      crossing.x,
      crossing.centerHeight,
      0,
    ]);
    expect(atCrossing.stopped).toBe(true);
    expect(heldAfter.visible).toBe(true);
    expect(heldAfter.position).toEqual(atCrossing.position);
    expect(heldAfter.velocity).toEqual([0, 0, 0]);
  });

  it('allows winner and out outcomes to reach the decisive first bounce', () => {
    compiled.points
      .filter(({ point }) => point.outcome !== 'net')
      .forEach((compiledPoint) => {
        const bounce = decisiveTrajectory(compiledPoint).bounces[0]!;
        const terminalTime = getPointTerminalTime(compiledPoint);
        const atBounce = getBallPoseAtTime(terminalTime, compiled);
        const heldAfter = getBallPoseAtTime(
          Math.min(compiledPoint.point.endT - 1e-4, terminalTime + 0.5),
          compiled,
        );

        expect(terminalTime).toBeCloseTo(bounce.t, 12);
        expect(atBounce.position).toEqual(bounce.position);
        expect(heldAfter.position).toEqual(bounce.position);
        expect(heldAfter.velocity).toEqual([0, 0, 0]);
      });
  });

  it('interpolates each player through their own authored contact stances', () => {
    const point = compiled.points[0]!.point;
    const nearContacts = point.shots.filter(({ by }) => by === 'near');
    const first = nearContacts[0]!;
    const second = nearContacts[1]!;
    const atFirst = getPlayerPoseAtTime('near', first.t, compiled);
    const atSecond = getPlayerPoseAtTime('near', second.t, compiled);
    const midpoint = getPlayerPoseAtTime(
      'near',
      (first.t + second.t) / 2,
      compiled,
    );

    expect(atFirst.contactPosition).toBe(first.from);
    expect(atSecond.contactPosition).toBe(second.from);
    expect(atFirst.position[2]).toBeLessThan(first.from[2]);
    expect(atSecond.position[2]).toBeLessThan(second.from[2]);
    expect(midpoint.position[0]).toBeGreaterThanOrEqual(
      Math.min(atFirst.position[0], atSecond.position[0]),
    );
    expect(midpoint.position[0]).toBeLessThanOrEqual(
      Math.max(atFirst.position[0], atSecond.position[0]),
    );
    expect(midpoint.position[2]).toBeGreaterThanOrEqual(
      Math.min(atFirst.position[2], atSecond.position[2]),
    );
    expect(midpoint.position[2]).toBeLessThanOrEqual(
      Math.max(atFirst.position[2], atSecond.position[2]),
    );

    const farContact = point.shots.find(({ by }) => by === 'far')!;
    const farPose = getPlayerPoseAtTime('far', farContact.t, compiled);
    expect(farPose.contactPosition).toBe(farContact.from);
    expect(farPose.position[2]).toBeGreaterThan(farContact.from[2]);
  });

  it('uses baseline-ready positions before, between, and after points', () => {
    const times = [
      compiled.points[0]!.point.startT - 1,
      (compiled.points[0]!.point.endT +
        compiled.points[1]!.point.startT) /
        2,
      compiled.points.at(-1)!.point.endT + 1,
    ];

    times.forEach((time) => {
      expect(getPlayerPoseAtTime('near', time, compiled).position).toEqual(
        BASELINE_READY_POSITIONS.near,
      );
      expect(getPlayerPoseAtTime('far', time, compiled).position).toEqual(
        BASELINE_READY_POSITIONS.far,
      );
    });
  });

  it('returns smooth swing phases and progress around each side contact', () => {
    const contact = compiled.points[0]!.point.shots[1]!;
    const early = getPlayerPoseAtTime(contact.by, contact.t - 0.25, compiled);
    const before = getPlayerPoseAtTime(contact.by, contact.t - 1e-4, compiled);
    const atContact = getPlayerPoseAtTime(contact.by, contact.t, compiled);
    const after = getPlayerPoseAtTime(contact.by, contact.t + 1e-4, compiled);
    const late = getPlayerPoseAtTime(contact.by, contact.t + 0.25, compiled);

    expect(early.swingPhase).toBe('backswing');
    expect(before.swingPhase).toBe('forward-swing');
    expect(atContact.swingPhase).toBe('follow-through');
    expect(late.swingPhase).toBe('follow-through');
    expect(early.swingProgress).toBeLessThan(before.swingProgress);
    expect(before.swingProgress).toBeLessThan(atContact.swingProgress);
    expect(atContact.swingProgress).toBeLessThan(after.swingProgress);
    expect(after.swingProgress).toBeLessThan(late.swingProgress);
    expect(atContact.swingProgress).toBeCloseTo(0.5, 12);
    expect(after.swingProgress - before.swingProgress).toBeLessThan(0.001);
    expect(atContact.swingShot).toBe(contact);
  });

  it('returns finite poses and rejects non-finite media times', () => {
    const times = compiled.points.flatMap(({ point, trajectories }) => [
      point.startT,
      ...point.shots.map(({ t }) => t),
      ...trajectories.map(({ netCrossing }) => netCrossing?.t ?? point.startT),
      getPointTerminalTime(
        compiled.points.find(({ point: candidate }) => candidate === point)!,
      ),
      point.endT - 1e-6,
    ]);

    times.forEach((time) => {
      const ball = getBallPoseAtTime(time, compiled);
      const near = getPlayerPoseAtTime('near', time, compiled);
      const far = getPlayerPoseAtTime('far', time, compiled);

      expect(
        [
          ...ball.position,
          ...ball.velocity,
          ...near.position,
          near.swingProgress,
          ...far.position,
          far.swingProgress,
        ].every(Number.isFinite),
      ).toBe(true);
    });

    const customEmpty: CompiledTennisMatch = {
      match: { ...compiled.match, points: [] },
      points: [],
    };
    expect(getBallPoseAtTime(10, customEmpty).visible).toBe(false);
    expect(() => getActivePointAtTime(Number.NaN, compiled)).toThrow(/finite/i);
    expect(() => getBallPoseAtTime(Number.POSITIVE_INFINITY, compiled)).toThrow(
      /finite/i,
    );
    expect(() => getPlayerPoseAtTime('near', Number.NaN, compiled)).toThrow(
      /finite/i,
    );
  });
});
