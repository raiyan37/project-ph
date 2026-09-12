import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INTEGRATION_STEP,
  sampleTrajectoryAt,
  singlesBoundaryMargin,
  solveTrajectory,
  type Shot,
} from './trajectory';
import {
  BALL_RADIUS,
  HALF_LENGTH,
  SINGLES_HALF_WIDTH,
  netHeightAt,
} from './court';

const serve: Shot = {
  t: 12.5,
  by: 'near',
  type: 'serve',
  from: [0, 2.65, -11.2],
  to: [1.2, 6.2],
  speed: 48,
  spin: 'flat',
};

function expectTupleClose(
  actual: readonly number[],
  expected: readonly number[],
  precision = 10,
): void {
  actual.forEach((value, index) => {
    expect(value).toBeCloseTo(expected[index]!, precision);
  });
}

function interpolateTuple(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  amount: number,
): readonly [number, number, number] {
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount,
  ];
}

describe('solveTrajectory', () => {
  it('uses a fixed 1/120 second step and keeps every sample finite', () => {
    const trajectory = solveTrajectory(serve);

    expect(trajectory.step).toBe(DEFAULT_INTEGRATION_STEP);
    expect(trajectory.step).toBe(1 / 120);
    expect(trajectory.samples.length).toBeGreaterThan(10);

    trajectory.samples.forEach((sample, index) => {
      expect(sample.elapsed).toBeCloseTo(index * DEFAULT_INTEGRATION_STEP, 12);
      expect(sample.t).toBeCloseTo(serve.t + sample.elapsed, 12);
      expect(
        [...sample.position, ...sample.velocity, sample.t, sample.elapsed].every(
          Number.isFinite,
        ),
      ).toBe(true);
    });
  });

  it('lands a plausible serve on its authored target and crosses the net', () => {
    const trajectory = solveTrajectory(serve);
    const bounce = trajectory.bounces[0];

    expect(bounce).toBeDefined();
    expect(
      Math.hypot(
        bounce!.position[0] - serve.to[0],
        bounce!.position[2] - serve.to[1],
      ),
    ).toBeLessThanOrEqual(0.15);
    expect(bounce!.t - serve.t).toBeGreaterThan(0.2);
    expect(bounce!.t - serve.t).toBeLessThan(2);
    expect(trajectory.netCrossing).toBeDefined();
    expect(trajectory.netCrossing!.t).toBeGreaterThan(serve.t);
    expect(trajectory.netCrossing!.t).toBeLessThan(bounce!.t);
  });

  it('computes net surface clearance from ball radius and local tape sag', () => {
    const crossing = solveTrajectory(serve).netCrossing;

    expect(crossing).toBeDefined();
    expect(crossing!.tapeHeight).toBeCloseTo(netHeightAt(crossing!.x), 12);
    expect(crossing!.surfaceClearance).toBeCloseTo(
      crossing!.centerHeight - BALL_RADIUS - netHeightAt(crossing!.x),
      12,
    );
  });

  it('reports signed singles margins inside, on lines, and outside corners', () => {
    expect(singlesBoundaryMargin(0, 0)).toBe(SINGLES_HALF_WIDTH);
    expect(singlesBoundaryMargin(SINGLES_HALF_WIDTH, 3)).toBe(0);
    expect(singlesBoundaryMargin(SINGLES_HALF_WIDTH + 0.2, 0)).toBeCloseTo(
      -0.2,
      12,
    );
    expect(
      singlesBoundaryMargin(
        SINGLES_HALF_WIDTH + 0.3,
        HALF_LENGTH + 0.4,
      ),
    ).toBeCloseTo(-0.5, 12);

    const bounce = solveTrajectory(serve).bounces[0]!;
    expect(bounce.inBounds).toBe(true);
    expect(bounce.singlesMargin).toBeGreaterThan(0);
  });

  it('applies restitution so the ball rises after its first bounce', () => {
    const trajectory = solveTrajectory(serve);
    const bounce = trajectory.bounces[0]!;
    const sampleAfterBounce = trajectory.samples.find(
      (sample) => sample.t > bounce.t,
    );

    expect(bounce.incomingVelocity[1]).toBeLessThan(0);
    expect(bounce.outgoingVelocity[1]).toBeGreaterThan(0);
    expect(sampleAfterBounce).toBeDefined();
    expect(sampleAfterBounce!.position[1]).toBeGreaterThan(BALL_RADIUS);
    expect(sampleAfterBounce!.velocity[1]).toBeGreaterThan(0);
  });

  it('never penetrates the ground and settles a low-energy ball', () => {
    const trajectory = solveTrajectory({
      t: 0,
      by: 'near',
      type: 'volley',
      from: [0, 0.034, -1],
      to: [0, -0.98],
      speed: 0.5,
      spin: 'flat',
    });
    const last = trajectory.samples.at(-1)!;

    trajectory.samples.forEach((sample) => {
      expect(sample.position[1]).toBeGreaterThanOrEqual(BALL_RADIUS - 1e-10);
    });
    expect(last.position[1]).toBeCloseTo(BALL_RADIUS, 12);
    expect(last.velocity[1]).toBe(0);
  });

  it('finds a narrow reachable range close to the maximum', () => {
    const shot: Shot = {
      t: 0,
      by: 'near',
      type: 'forehand',
      from: [0, 1, -7.566],
      to: [0, 7.566],
      speed: 12,
      spin: 'flat',
    };
    const trajectory = solveTrajectory(shot);

    expect(trajectory.landingError).toBeLessThan(0.0001);
    expect(trajectory.bounces[0]!.position[2]).toBeCloseTo(shot.to[1], 4);
  });

  it('detects a post-bounce net crossing on its chronological free segment', () => {
    const trajectory = solveTrajectory({
      ...serve,
      t: 0,
      from: [0, 0.8, -5],
      to: [0, -0.2],
      speed: 45,
    });
    const bounce = trajectory.bounces[0]!;
    const crossing = trajectory.netCrossing!;
    const firstPostBounceSample = trajectory.samples.find(
      (sample) => sample.t > bounce.t,
    )!;
    const amount =
      -bounce.position[2] /
      (firstPostBounceSample.position[2] - bounce.position[2]);
    const expectedT =
      bounce.t + amount * (firstPostBounceSample.t - bounce.t);
    const expectedY =
      bounce.position[1] +
      amount *
        (firstPostBounceSample.position[1] - bounce.position[1]);

    expect(
      Math.floor(bounce.elapsed / DEFAULT_INTEGRATION_STEP),
    ).toBe(Math.floor(crossing.elapsed / DEFAULT_INTEGRATION_STEP));
    expect(crossing.t).toBeGreaterThan(bounce.t);
    expect(crossing.t).toBeCloseTo(expectedT, 10);
    expect(crossing.centerHeight).toBeCloseTo(expectedY, 10);
  });

  it('gives flat and topspin shots different Magnus-shaped arcs', () => {
    const flat = solveTrajectory(serve);
    const topspin = solveTrajectory({ ...serve, spin: 'topspin' });
    const elapsed = Math.min(
      flat.bounces[0]!.elapsed,
      topspin.bounces[0]!.elapsed,
    ) * 0.5;
    const flatMidpoint = sampleTrajectoryAt(flat, serve.t + elapsed);
    const topspinMidpoint = sampleTrajectoryAt(topspin, serve.t + elapsed);

    expect(
      Math.abs(topspinMidpoint.position[1] - flatMidpoint.position[1]),
    ).toBeGreaterThan(0.01);
  });

  it('returns the outgoing bounce state at the exact bounce time', () => {
    const trajectory = solveTrajectory(serve);
    const bounce = trajectory.bounces[0]!;
    const sampled = sampleTrajectoryAt(trajectory, bounce.t);

    expect(sampled.t).toBeCloseTo(bounce.t, 12);
    expect(sampled.elapsed).toBeCloseTo(bounce.elapsed, 12);
    expectTupleClose(sampled.position, bounce.position, 12);
    expectTupleClose(sampled.velocity, bounce.outgoingVelocity, 12);
  });

  it('interpolates against incoming and outgoing bounce sides', () => {
    const trajectory = solveTrajectory(serve);
    const bounce = trajectory.bounces[0]!;
    const previous = [...trajectory.samples]
      .reverse()
      .find((sample) => sample.t < bounce.t)!;
    const next = trajectory.samples.find((sample) => sample.t > bounce.t)!;
    const beforeT = bounce.t - 0.0001;
    const afterT = bounce.t + 0.0001;
    const beforeAmount = (beforeT - previous.t) / (bounce.t - previous.t);
    const afterAmount = (afterT - bounce.t) / (next.t - bounce.t);
    const before = sampleTrajectoryAt(trajectory, beforeT);
    const after = sampleTrajectoryAt(trajectory, afterT);

    expectTupleClose(
      before.position,
      interpolateTuple(previous.position, bounce.position, beforeAmount),
    );
    expectTupleClose(
      before.velocity,
      interpolateTuple(
        previous.velocity,
        bounce.incomingVelocity,
        beforeAmount,
      ),
    );
    expectTupleClose(
      after.position,
      interpolateTuple(bounce.position, next.position, afterAmount),
    );
    expectTupleClose(
      after.velocity,
      interpolateTuple(
        bounce.outgoingVelocity,
        next.velocity,
        afterAmount,
      ),
    );
    expect(before.velocity[1]).toBeLessThan(0);
    expect(after.velocity[1]).toBeGreaterThan(0);
  });

  it('samples absolute media time with interpolation and endpoint clamping', () => {
    const trajectory = solveTrajectory(serve);
    const first = trajectory.samples[0]!;
    const a = trajectory.samples[10]!;
    const b = trajectory.samples[11]!;
    const last = trajectory.samples.at(-1)!;
    const midpointT = (a.t + b.t) / 2;
    const midpoint = sampleTrajectoryAt(trajectory, midpointT);

    expect(sampleTrajectoryAt(trajectory, serve.t - 100)).toEqual(first);
    expect(sampleTrajectoryAt(trajectory, last.t + 100)).toEqual(last);
    expect(midpoint.t).toBeCloseTo(midpointT, 12);
    expect(midpoint.elapsed).toBeCloseTo((a.elapsed + b.elapsed) / 2, 12);
    midpoint.position.forEach((coordinate, index) => {
      expect(coordinate).toBeCloseTo(
        (a.position[index]! + b.position[index]!) / 2,
        12,
      );
    });
    midpoint.velocity.forEach((component, index) => {
      expect(component).toBeCloseTo(
        (a.velocity[index]! + b.velocity[index]!) / 2,
        12,
      );
    });
  });

  it('classifies exact singles sideline and baseline bounces as on-line', () => {
    const lineShots: readonly Shot[] = [
      { ...serve, to: [SINGLES_HALF_WIDTH, 6.2] },
      { ...serve, to: [0, HALF_LENGTH] },
    ];

    lineShots.forEach((shot) => {
      const trajectory = solveTrajectory(shot);
      const bounce = trajectory.bounces[0]!;

      expect(trajectory.landingError).toBeLessThan(0.0001);
      expect(bounce.inBounds).toBe(true);
      expect(bounce.singlesMargin).toBe(0);
    });
  });

  it('always uses the fixed default step even with a forged legacy override', () => {
    const trajectory = solveTrajectory(
      serve,
      { step: 1 / 60 } as never,
    );

    expect(trajectory.step).toBe(DEFAULT_INTEGRATION_STEP);
  });

  it('reports negative clearance for a solved shot through the net', () => {
    const shot: Shot = {
      ...serve,
      from: [0, 0.8, -8],
      to: [0, 8],
      speed: 45,
    };
    const trajectory = solveTrajectory(shot);

    expect(trajectory.landingError).toBeLessThan(0.0001);
    expect(trajectory.netCrossing).toBeDefined();
    expect(trajectory.netCrossing!.surfaceClearance).toBeLessThan(0);
  });

  it('treats maxFlightTime as an exact first-bounce upper bound', () => {
    const shot: Shot = {
      t: 0,
      by: 'near',
      type: 'volley',
      from: [0, BALL_RADIUS + 0.001, -1],
      to: [0, -0.999],
      speed: 2,
      spin: 'flat',
    };

    expect(() =>
      solveTrajectory(shot, { maxFlightTime: 0.0001 }),
    ).toThrow(/unreachable/i);
  });

  it('throws descriptive errors for invalid and unreachable shots', () => {
    expect(() => solveTrajectory({ ...serve, speed: 0 })).toThrow(
      /speed.*positive/i,
    );
    expect(() =>
      solveTrajectory({ ...serve, from: [Number.NaN, 2, -10] }),
    ).toThrow(/finite/i);
    expect(() =>
      solveTrajectory({
        ...serve,
        from: [0, 1, -11],
        to: [0, 11],
        speed: 5,
      }),
    ).toThrow(/unreachable/i);
  });
});
