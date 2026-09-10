import type { CompiledPoint, PointOutcome } from '../../data/tennis/match';
import {
  BALL_RADIUS,
  HALF_LENGTH,
  SINGLES_HALF_WIDTH,
  type Vec3,
} from './court';
import { sampleTrajectoryAt } from './trajectory';

export type ReplayCameraId = 'net-side' | 'overhead' | 'down-the-line';

export interface ReplayCamera {
  readonly id: ReplayCameraId;
  readonly label: string;
  readonly position: Vec3;
  readonly target: Vec3;
  readonly fov: number;
}

export type ReplayMeasurementKind = 'net-clearance' | 'in-out';

export interface ReplayMeasurement {
  readonly kind: ReplayMeasurementKind;
  readonly valueMeters: number;
  readonly inBounds?: boolean;
  readonly display: string;
  readonly from: Vec3;
  readonly to: Vec3;
}

export interface BoundaryMark {
  readonly axis: 'x' | 'z';
  readonly line: number;
  readonly distance: number;
  readonly point: Vec3;
}

function centimetres(meters: number): number {
  return Math.round(Math.abs(meters) * 100);
}

function decisiveTrajectory(compiledPoint: CompiledPoint) {
  const index = compiledPoint.point.decisiveShotIndex;
  const trajectory = compiledPoint.trajectories[index];
  if (!trajectory) {
    throw new Error('Replay is missing a decisive trajectory.');
  }
  return trajectory;
}

export function nearestSinglesBoundary(x: number, z: number): BoundaryMark {
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    throw new Error('Boundary coordinates must be finite.');
  }
  const distX = Math.abs(Math.abs(x) - SINGLES_HALF_WIDTH);
  const distZ = Math.abs(Math.abs(z) - HALF_LENGTH);
  if (distX <= distZ) {
    const line = (x === 0 ? 1 : Math.sign(x)) * SINGLES_HALF_WIDTH;
    return {
      axis: 'x',
      line,
      distance: distX,
      point: [line, 0, z],
    };
  }
  const line = (z === 0 ? 1 : Math.sign(z)) * HALF_LENGTH;
  return {
    axis: 'z',
    line,
    distance: distZ,
    point: [x, 0, line],
  };
}

export function replayCameraForOutcome(outcome: PointOutcome): ReplayCamera {
  if (outcome === 'net') {
    return {
      id: 'net-side',
      label: 'Net cord',
      position: [8.4, 1.07, 0],
      target: [0, 0.96, 0],
      fov: 38,
    };
  }
  if (outcome === 'out') {
    return {
      id: 'overhead',
      label: 'Line call',
      position: [0, 22, 0.01],
      target: [0, 0, 0],
      fov: 42,
    };
  }
  return {
    id: 'down-the-line',
    label: 'Winner',
    position: [-1.1, 1.45, -(HALF_LENGTH + 1.7)],
    target: [0.4, 0.45, 3.2],
    fov: 46,
  };
}

export function replayMeasurement(
  compiledPoint: CompiledPoint,
): ReplayMeasurement {
  const trajectory = decisiveTrajectory(compiledPoint);
  if (compiledPoint.point.outcome === 'net') {
    const crossing = trajectory.netCrossing;
    if (!crossing) {
      throw new Error('Net replay requires a tape crossing.');
    }
    const valueMeters = crossing.surfaceClearance;
    const cm = centimetres(valueMeters);
    return {
      kind: 'net-clearance',
      valueMeters,
      display:
        valueMeters < 0
          ? `clipped the tape by ${cm} cm`
          : `cleared the tape by ${cm} cm`,
      from: [crossing.x, crossing.tapeHeight, 0],
      to: [crossing.x, crossing.centerHeight, 0],
    };
  }

  const bounce = trajectory.bounces[0];
  if (!bounce) {
    throw new Error('Line-call replay requires a bounce.');
  }
  const valueMeters = bounce.singlesMargin;
  const cm = centimetres(valueMeters);
  const boundary = nearestSinglesBoundary(bounce.position[0], bounce.position[2]);
  return {
    kind: 'in-out',
    valueMeters,
    inBounds: bounce.inBounds,
    display: bounce.inBounds ? `in by ${cm} cm` : `out by ${cm} cm`,
    from: bounce.position,
    to: [boundary.point[0], BALL_RADIUS, boundary.point[2]],
  };
}

export function replayTrail(
  compiledPoint: CompiledPoint,
  mediaTime: number,
): Vec3[] {
  if (!Number.isFinite(mediaTime)) {
    throw new Error('Replay trail time must be finite.');
  }
  const trajectory = decisiveTrajectory(compiledPoint);
  const endTime = Math.min(
    mediaTime,
    trajectory.samples.at(-1)?.t ?? mediaTime,
  );
  const points: Vec3[] = [trajectory.shot.from];
  trajectory.samples.forEach((sample) => {
    if (sample.t <= endTime && sample.t > trajectory.shot.t) {
      points.push(sample.position);
    }
  });
  if (endTime > trajectory.shot.t) {
    const live = sampleTrajectoryAt(trajectory, endTime);
    const last = points.at(-1);
    if (
      !last ||
      last[0] !== live.position[0] ||
      last[1] !== live.position[1] ||
      last[2] !== live.position[2]
    ) {
      points.push(live.position);
    }
  }
  return points;
}
