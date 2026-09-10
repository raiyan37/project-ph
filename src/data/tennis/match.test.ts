import { describe, expect, it, vi } from 'vitest';
import {
  HALF_LENGTH,
  SERVICE_LINE_DISTANCE,
  SINGLES_HALF_WIDTH,
} from '../../lib/tennis/court';
import {
  sampleTrajectoryAt,
  type ShotPlayerSide,
  type Trajectory,
} from '../../lib/tennis/trajectory';
import {
  CARLOS_ALCARAZ,
  JANNIK_SINNER,
  SCRIPTED_POINTS,
  TENNIS_MATCH,
  TENNIS_PLAYERS,
  compileTennisMatch,
  getCompiledTennisMatch,
  getReplayAtMediaTime,
  type CompiledTennisMatch,
} from './match';

const OPENING_SEGMENTS = [13, 36, 54, 83] as const;

function playerIdForSide(side: ShotPlayerSide): string {
  return TENNIS_PLAYERS[side].id;
}

function decisiveTrajectory(pointIndex: number): Trajectory {
  const compiledPoint = getCompiledTennisMatch().points[pointIndex]!;
  return compiledPoint.trajectories[compiledPoint.point.decisiveShotIndex]!;
}

function trajectoryFingerprint(trajectory: Trajectory) {
  return {
    landingError: trajectory.landingError,
    launchElevation: trajectory.launchElevation,
    launchVelocity: trajectory.launchVelocity,
    netCrossing: trajectory.netCrossing,
    firstBounce: trajectory.bounces[0],
    samples: trajectory.samples,
  };
}

describe('tennis match data', () => {
  it('lazily memoizes the default without compiling it for custom lookup', async () => {
    vi.resetModules();
    const physics = await vi.importActual<
      typeof import('../../lib/tennis/trajectory')
    >('../../lib/tennis/trajectory');
    const solveTrajectory = vi.fn(physics.solveTrajectory);
    vi.doMock('../../lib/tennis/trajectory', () => ({
      ...physics,
      solveTrajectory,
    }));

    try {
      const lazyMatch = await import('./match');
      const point = lazyMatch.SCRIPTED_POINTS[0]!;
      const customTrajectory = {} as Trajectory;
      const customCompiled: CompiledTennisMatch = {
        match: lazyMatch.TENNIS_MATCH,
        points: [
          {
            point,
            trajectories: [customTrajectory],
          },
        ],
      };

      expect(solveTrajectory).not.toHaveBeenCalled();
      const customReplay = lazyMatch.getReplayAtMediaTime(
        point.startT,
        customCompiled,
      );
      expect(customReplay?.compiledPoint).toBe(customCompiled.points[0]);
      expect(customReplay?.trajectory).toBe(customTrajectory);
      expect(solveTrajectory).not.toHaveBeenCalled();

      const replayFromDefault = lazyMatch.getReplayAtMediaTime(point.startT);
      const first = lazyMatch.getCompiledTennisMatch();
      const solveCount = lazyMatch.SCRIPTED_POINTS.reduce(
        (count, scriptedPoint) => count + scriptedPoint.shots.length,
        0,
      );
      expect(solveTrajectory).toHaveBeenCalledTimes(solveCount);
      expect(replayFromDefault?.compiledPoint).toBe(first.points[0]);
      expect(lazyMatch.getCompiledTennisMatch()).toBe(first);
      expect(solveTrajectory).toHaveBeenCalledTimes(solveCount);
    } finally {
      vi.doUnmock('../../lib/tennis/trajectory');
      vi.resetModules();
    }
  });

  it('exports the official source, tournament, round, and court-side players', () => {
    expect(CARLOS_ALCARAZ).toMatchObject({
      id: 'carlos-alcaraz',
      name: 'Carlos Alcaraz',
      country: 'Spain',
      side: 'near',
    });
    expect(JANNIK_SINNER).toMatchObject({
      id: 'jannik-sinner',
      name: 'Jannik Sinner',
      country: 'Italy',
      side: 'far',
    });
    expect(TENNIS_PLAYERS).toEqual({
      near: CARLOS_ALCARAZ,
      far: JANNIK_SINNER,
    });

    expect(TENNIS_MATCH).toMatchObject({
      tournament: 'US Open',
      year: 2025,
      round: 'Final',
      players: TENNIS_PLAYERS,
      source: {
        youtubeId: 'DHo1mw7lj3s',
        title:
          'Jannik Sinner vs. Carlos Alcaraz Extended Highlights | 2025 US Open Final',
        channel: 'US Open Tennis Championships',
        duration: 704.121,
        url: 'https://www.youtube.com/watch?v=DHo1mw7lj3s',
        timing: 'authored-approximate',
      },
    });
  });

  it('contains exactly four ordered, non-overlapping scripted points', () => {
    expect(SCRIPTED_POINTS).toHaveLength(4);
    expect(TENNIS_MATCH.points).toBe(SCRIPTED_POINTS);

    SCRIPTED_POINTS.forEach((point, pointIndex) => {
      expect(point.id).toMatch(/^point-\d{2}$/);
      expect(point.startT).toBeCloseTo(OPENING_SEGMENTS[pointIndex]!, 6);
      expect(point.endT).toBeGreaterThan(point.startT);
      expect(point.replayLabel.trim().length).toBeGreaterThan(0);
      expect(['winner', 'net', 'out']).toContain(point.outcome);
      expect(['carlos-alcaraz', 'jannik-sinner']).toContain(point.server);
      expect(['carlos-alcaraz', 'jannik-sinner']).toContain(point.winner);
      expect(point.shots.length).toBeGreaterThanOrEqual(4);
      expect(point.shots.length).toBeLessThanOrEqual(9);
      expect(point.decisiveShotIndex).toBeGreaterThanOrEqual(0);
      expect(point.decisiveShotIndex).toBeLessThan(point.shots.length);
      expect(point.shots[0]!.t).toBe(point.startT);
      expect(playerIdForSide(point.shots[0]!.by)).toBe(point.server);

      if (pointIndex > 0) {
        expect(point.startT).toBeGreaterThan(
          SCRIPTED_POINTS[pointIndex - 1]!.endT,
        );
      }
    });
  });

  it('keeps authored shots chronological, alternating, and court-plausible', () => {
    const shotTypes = new Set<string>();
    const spins = new Set<string>();

    SCRIPTED_POINTS.forEach((point) => {
      point.shots.forEach((shot, shotIndex) => {
        shotTypes.add(shot.type);
        spins.add(shot.spin);

        expect(shot.t).toBeGreaterThanOrEqual(point.startT);
        expect(shot.t).toBeLessThan(point.endT);
        expect(shot.from[1]).toBeGreaterThanOrEqual(0.45);
        expect(shot.from[1]).toBeLessThanOrEqual(3.4);
        expect(Math.abs(shot.from[0])).toBeLessThanOrEqual(5.5);
        expect(Math.abs(shot.from[2])).toBeLessThanOrEqual(13);
        expect(Math.abs(shot.to[0])).toBeLessThanOrEqual(
          SINGLES_HALF_WIDTH + 0.12,
        );
        expect(Math.abs(shot.to[1])).toBeLessThanOrEqual(HALF_LENGTH + 0.12);
        expect(Math.sign(shot.from[2])).toBe(shot.by === 'near' ? -1 : 1);
        expect(Math.sign(shot.to[1])).toBe(shot.by === 'near' ? 1 : -1);

        if (shot.type === 'serve') {
          expect(shot.speed).toBeLessThanOrEqual(60);
          expect(Math.abs(shot.to[1])).toBeLessThanOrEqual(
            SERVICE_LINE_DISTANCE,
          );
        } else {
          expect(shot.speed).toBeLessThanOrEqual(45);
        }
        expect(shot.speed).toBeGreaterThan(5);

        if (shotIndex > 0) {
          const previous = point.shots[shotIndex - 1]!;
          expect(shot.t).toBeGreaterThan(previous.t);
          expect(shot.by).not.toBe(previous.by);
        }
      });
    });

    expect([...shotTypes].sort()).toEqual([
      'backhand',
      'forehand',
      'serve',
      'volley',
    ]);
    expect([...spins].sort()).toEqual(['flat', 'slice', 'topspin']);
  });

  it('solves every shot accurately with finite deterministic samples', () => {
    getCompiledTennisMatch().points.forEach(({ point, trajectories }) => {
      expect(trajectories).toHaveLength(point.shots.length);

      trajectories.forEach((trajectory, shotIndex) => {
        expect(trajectory.shot).toBe(point.shots[shotIndex]);
        expect(trajectory.landingError).toBeLessThan(0.01);
        expect(trajectory.bounces[0]).toBeDefined();
        expect(trajectory.samples.length).toBeGreaterThan(1);
        trajectory.samples.forEach((sample) => {
          expect(
            [
              sample.t,
              sample.elapsed,
              ...sample.position,
              ...sample.velocity,
            ].every(Number.isFinite),
          ).toBe(true);
        });
      });
    });

    const first = compileTennisMatch(TENNIS_MATCH);
    const second = compileTennisMatch(TENNIS_MATCH);
    const independent = compileTennisMatch({ ...TENNIS_MATCH });
    expect(first).toBe(getCompiledTennisMatch());
    expect(second).toBe(first);
    expect(independent).not.toBe(first);
    expect(
      first.points.flatMap((point) =>
        point.trajectories.map(trajectoryFingerprint),
      ),
    ).toEqual(
      independent.points.flatMap((point) =>
        point.trajectories.map(trajectoryFingerprint),
      ),
    );
  });

  it('keeps consecutive authored contacts continuous without hidden cuts', () => {
    getCompiledTennisMatch().points.forEach(({ point, trajectories }) => {
      expect(point.cutBefore).not.toBe(true);

      point.shots.slice(1).forEach((shot, shotIndex) => {
        expect(shot.cutBefore).not.toBe(true);
        const priorPosition = sampleTrajectoryAt(
          trajectories[shotIndex]!,
          shot.t,
        ).position;
        const contactGap = Math.hypot(
          priorPosition[0] - shot.from[0],
          priorPosition[1] - shot.from[1],
          priorPosition[2] - shot.from[2],
        );

        expect(contactGap).toBeLessThanOrEqual(1.5);
      });
    });
  });

  it('clears the net and lands in except at the two scripted misses', () => {
    getCompiledTennisMatch().points.forEach(({ point, trajectories }) => {
      trajectories.forEach((trajectory, shotIndex) => {
        const isDecisive = shotIndex === point.decisiveShotIndex;
        const isNetMiss = isDecisive && point.outcome === 'net';
        const isOutMiss = isDecisive && point.outcome === 'out';

        expect(trajectory.netCrossing).toBeDefined();
        if (isNetMiss) {
          expect(trajectory.netCrossing!.surfaceClearance).toBeLessThan(0);
        } else {
          expect(trajectory.netCrossing!.surfaceClearance).toBeGreaterThan(0);
        }
        expect(trajectory.bounces[0]!.inBounds).toBe(!isOutMiss);
      });
    });
  });

  it('includes winner, slight-net, marginal-out, and volley showcases', () => {
    expect(SCRIPTED_POINTS.map(({ outcome }) => outcome)).toEqual([
      'winner',
      'net',
      'out',
      'winner',
    ]);

    const cleanWinner = decisiveTrajectory(0);
    expect(cleanWinner.bounces[0]!.singlesMargin).toBeGreaterThan(0.5);
    expect(cleanWinner.netCrossing!.surfaceClearance).toBeGreaterThan(0.1);

    const slightNet = decisiveTrajectory(1);
    expect(slightNet.netCrossing).toBeDefined();
    expect(slightNet.netCrossing!.surfaceClearance).toBeLessThan(0);
    expect(slightNet.netCrossing!.surfaceClearance).toBeGreaterThanOrEqual(
      -0.08,
    );

    const marginalOut = decisiveTrajectory(2);
    expect(marginalOut.bounces[0]!.singlesMargin).toBeLessThanOrEqual(-0.02);
    expect(marginalOut.bounces[0]!.singlesMargin).toBeGreaterThanOrEqual(-0.12);

    const volleyWinner = getCompiledTennisMatch().points[3]!;
    expect(
      volleyWinner.point.shots[volleyWinner.point.decisiveShotIndex]!.type,
    ).toBe('volley');

    getCompiledTennisMatch().points.forEach(({ point }) => {
      const decisiveShot = point.shots[point.decisiveShotIndex]!;
      const decisivePlayer = playerIdForSide(decisiveShot.by);
      if (point.outcome === 'winner') {
        expect(decisivePlayer).toBe(point.winner);
      } else {
        expect(decisivePlayer).not.toBe(point.winner);
      }
    });
  });

  it('looks up point and solved trajectory at media-time boundaries', () => {
    expect(getReplayAtMediaTime(SCRIPTED_POINTS[0]!.startT - 0.001)).toBeUndefined();

    SCRIPTED_POINTS.forEach((point, pointIndex) => {
      const atStart = getReplayAtMediaTime(point.startT);
      expect(atStart?.point).toBe(point);
      expect(atStart?.compiledPoint).toBe(
        getCompiledTennisMatch().points[pointIndex],
      );
      expect(atStart?.shotIndex).toBe(0);
      expect(atStart?.trajectory).toBe(
        getCompiledTennisMatch().points[pointIndex]!.trajectories[0],
      );

      point.shots.slice(1).forEach((shot, shotIndex) => {
        expect(getReplayAtMediaTime(shot.t - 1e-6)?.shotIndex).toBe(shotIndex);
        expect(getReplayAtMediaTime(shot.t)?.shotIndex).toBe(shotIndex + 1);
      });

      expect(getReplayAtMediaTime(point.endT - 1e-6)?.point).toBe(point);
      expect(getReplayAtMediaTime(point.endT)).toBeUndefined();
    });

    expect(() => getReplayAtMediaTime(Number.NaN)).toThrow(/finite/i);
  });
});
