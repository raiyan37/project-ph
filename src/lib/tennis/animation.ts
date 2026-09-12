import type {
  CompiledPoint,
  CompiledTennisMatch,
  ScriptedShot,
} from '../../data/tennis/match';
import { BALL_RADIUS, HALF_LENGTH, type Vec3 } from './court';
import {
  sampleTrajectoryAt,
  type ShotPlayerSide,
  type Trajectory,
} from './trajectory';

const CONTACT_BLEND_DURATION = 0.08;
const SWING_HALF_WINDOW = 0.42;
const FORWARD_SWING_LEAD = 0.12;
const STANCE_DEPTH = 0.42;

const ZERO_VECTOR: Vec3 = [0, 0, 0];
const HIDDEN_BALL_POSITION: Vec3 = [0, BALL_RADIUS, 0];

export const BASELINE_READY_POSITIONS = {
  near: [0, 0, -(HALF_LENGTH + 0.7)],
  far: [0, 0, HALF_LENGTH + 0.7],
} as const satisfies Readonly<Record<ShotPlayerSide, Vec3>>;

export type MatchTimeSource = Readonly<{ current: number }>;

export interface ActivePointAtTime {
  readonly compiledPoint: CompiledPoint;
  readonly pointIndex: number;
  readonly terminalTime: number;
  readonly sampleTime: number;
  readonly stopped: boolean;
}

export interface ActiveTrajectoryAtTime extends ActivePointAtTime {
  readonly trajectory: Trajectory;
  readonly shotIndex: number;
}

export interface BallPose {
  readonly visible: boolean;
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly stopped: boolean;
  readonly compiledPoint?: CompiledPoint;
  readonly trajectory?: Trajectory;
  readonly shotIndex?: number;
}

export type SwingPhase =
  | 'ready'
  | 'backswing'
  | 'forward-swing'
  | 'follow-through';

export interface PlayerPose {
  readonly side: ShotPlayerSide;
  readonly position: Vec3;
  readonly contactPosition: Vec3 | undefined;
  readonly swingPhase: SwingPhase;
  /** Smoothly eased progress through the complete contact window. */
  readonly swingProgress: number;
  readonly swingShot: ScriptedShot | undefined;
  readonly active: boolean;
}

interface PlayerKeyframe {
  readonly t: number;
  readonly position: Vec3;
}

function assertFiniteMediaTime(mediaTime: number): void {
  if (!Number.isFinite(mediaTime)) {
    throw new Error('Tennis animation media time must be finite.');
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function smoothstep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function lerpVec3(from: Vec3, to: Vec3, amount: number): Vec3 {
  return [
    lerp(from[0], to[0], amount),
    lerp(from[1], to[1], amount),
    lerp(from[2], to[2], amount),
  ];
}

/**
 * The decisive event is a tape crossing for net errors and the first ground
 * contact for winners/out balls. The authored point window remains active so
 * callers can hold that decisive frame until the source video moves on.
 */
export function getPointTerminalTime(compiledPoint: CompiledPoint): number {
  const { point, trajectories } = compiledPoint;
  const decisiveIndex = clamp(
    point.decisiveShotIndex,
    0,
    Math.max(0, trajectories.length - 1),
  );
  const decisive = trajectories[decisiveIndex];
  const decisiveShot = point.shots[decisiveIndex];
  const lastSampleTime = decisive?.samples.at(-1)?.t;
  const eventTime =
    point.outcome === 'net'
      ? decisive?.netCrossing?.t
      : decisive?.bounces[0]?.t;
  const fallbackTime =
    eventTime ??
    decisive?.bounces[0]?.t ??
    lastSampleTime ??
    decisiveShot?.t ??
    point.endT;

  return clamp(
    Number.isFinite(fallbackTime) ? fallbackTime : point.endT,
    point.startT,
    point.endT,
  );
}

export function getActivePointAtTime(
  mediaTime: number,
  compiled: CompiledTennisMatch,
): ActivePointAtTime | undefined {
  assertFiniteMediaTime(mediaTime);

  let low = 0;
  let high = compiled.points.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const compiledPoint = compiled.points[middle]!;
    const { point } = compiledPoint;

    if (mediaTime < point.startT) {
      high = middle - 1;
      continue;
    }
    if (mediaTime >= point.endT) {
      low = middle + 1;
      continue;
    }

    const terminalTime = getPointTerminalTime(compiledPoint);
    return {
      compiledPoint,
      pointIndex: middle,
      terminalTime,
      sampleTime: Math.min(mediaTime, terminalTime),
      stopped: mediaTime >= terminalTime,
    };
  }

  return undefined;
}

export function getActiveTrajectoryAtTime(
  mediaTime: number,
  compiled: CompiledTennisMatch,
): ActiveTrajectoryAtTime | undefined {
  const activePoint = getActivePointAtTime(mediaTime, compiled);
  if (!activePoint) {
    return undefined;
  }

  const { point, trajectories } = activePoint.compiledPoint;
  if (point.shots.length === 0 || trajectories.length === 0) {
    return undefined;
  }

  let low = 0;
  let high = Math.min(
    point.decisiveShotIndex,
    point.shots.length - 1,
    trajectories.length - 1,
  );
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (point.shots[middle]!.t <= activePoint.sampleTime) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  const trajectory = trajectories[low];
  if (!trajectory) {
    return undefined;
  }

  return {
    ...activePoint,
    trajectory,
    shotIndex: low,
  };
}

function stoppedBallPosition(active: ActiveTrajectoryAtTime): Vec3 {
  const { point, trajectories } = active.compiledPoint;
  const decisive = trajectories[point.decisiveShotIndex];

  if (point.outcome === 'net' && decisive?.netCrossing) {
    const crossing = decisive.netCrossing;
    return [crossing.x, crossing.centerHeight, 0];
  }
  if (decisive?.bounces[0]) {
    return decisive.bounces[0].position;
  }

  return sampleTrajectoryAt(active.trajectory, active.sampleTime).position;
}

function blendToNextContact(
  active: ActiveTrajectoryAtTime,
  position: Vec3,
  velocity: Vec3,
): Pick<BallPose, 'position' | 'velocity'> {
  const { point, trajectories } = active.compiledPoint;
  const nextIndex = active.shotIndex + 1;
  if (nextIndex > point.decisiveShotIndex) {
    return { position, velocity };
  }

  const currentShot = point.shots[active.shotIndex];
  const nextShot = point.shots[nextIndex];
  const nextTrajectory = trajectories[nextIndex];
  if (!currentShot || !nextShot || nextShot.cutBefore) {
    return { position, velocity };
  }

  const contactInterval = nextShot.t - currentShot.t;
  const blendDuration = Math.min(
    CONTACT_BLEND_DURATION,
    Math.max(contactInterval * 0.25, 0),
  );
  if (
    blendDuration <= 0 ||
    active.sampleTime < nextShot.t - blendDuration ||
    active.sampleTime >= nextShot.t
  ) {
    return { position, velocity };
  }

  const amount = smoothstep(
    (active.sampleTime - (nextShot.t - blendDuration)) / blendDuration,
  );
  const contactVelocity = nextTrajectory?.samples[0]?.velocity ?? velocity;
  return {
    position: lerpVec3(position, nextShot.from, amount),
    velocity: lerpVec3(velocity, contactVelocity, amount),
  };
}

export function getBallPoseAtTime(
  mediaTime: number,
  compiled: CompiledTennisMatch,
): BallPose {
  const active = getActiveTrajectoryAtTime(mediaTime, compiled);
  if (!active) {
    return {
      visible: false,
      position: HIDDEN_BALL_POSITION,
      velocity: ZERO_VECTOR,
      stopped: false,
    };
  }

  if (active.stopped) {
    return {
      visible: true,
      position: stoppedBallPosition(active),
      velocity: ZERO_VECTOR,
      stopped: true,
      compiledPoint: active.compiledPoint,
      trajectory: active.trajectory,
      shotIndex: active.shotIndex,
    };
  }

  const sample = sampleTrajectoryAt(active.trajectory, active.sampleTime);
  const blended = blendToNextContact(
    active,
    sample.position,
    sample.velocity,
  );
  return {
    visible: true,
    position: blended.position,
    velocity: blended.velocity,
    stopped: false,
    compiledPoint: active.compiledPoint,
    trajectory: active.trajectory,
    shotIndex: active.shotIndex,
  };
}

function stancePositionForShot(shot: ScriptedShot): Vec3 {
  const localRight = shot.by === 'near' ? 1 : -1;
  const lateralReach =
    shot.type === 'forehand'
      ? 0.48
      : shot.type === 'backhand'
        ? -0.38
        : shot.type === 'volley'
          ? 0.35
          : 0.12;
  const depthDirection = shot.by === 'near' ? -1 : 1;

  return [
    shot.from[0] - localRight * lateralReach,
    0,
    shot.from[2] + depthDirection * STANCE_DEPTH,
  ];
}

function playerKeyframes(
  side: ShotPlayerSide,
  active: ActivePointAtTime,
): readonly PlayerKeyframe[] {
  const { point } = active.compiledPoint;
  const baseline = BASELINE_READY_POSITIONS[side];
  const keyframes: PlayerKeyframe[] = [
    { t: point.startT, position: baseline },
  ];

  point.shots
    .slice(0, point.decisiveShotIndex + 1)
    .filter((shot) => shot.by === side)
    .forEach((shot) => {
      const frame = { t: shot.t, position: stancePositionForShot(shot) };
      const previous = keyframes.at(-1);
      if (previous?.t === frame.t) {
        keyframes[keyframes.length - 1] = frame;
      } else {
        keyframes.push(frame);
      }
    });

  keyframes.push({ t: point.endT, position: baseline });
  return keyframes;
}

function samplePlayerPosition(
  side: ShotPlayerSide,
  mediaTime: number,
  active: ActivePointAtTime,
): Vec3 {
  const keyframes = playerKeyframes(side, active);
  const first = keyframes[0]!;
  const last = keyframes.at(-1)!;
  if (mediaTime <= first.t) {
    return first.position;
  }
  if (mediaTime >= last.t) {
    return last.position;
  }

  let fromIndex = 0;
  while (
    fromIndex + 1 < keyframes.length &&
    keyframes[fromIndex + 1]!.t <= mediaTime
  ) {
    fromIndex += 1;
  }
  const from = keyframes[fromIndex]!;
  const to = keyframes[fromIndex + 1]!;
  const amount = smoothstep((mediaTime - from.t) / (to.t - from.t));
  return lerpVec3(from.position, to.position, amount);
}

function swingAtTime(
  side: ShotPlayerSide,
  mediaTime: number,
  active: ActivePointAtTime,
): Pick<
  PlayerPose,
  'contactPosition' | 'swingPhase' | 'swingProgress' | 'swingShot'
> {
  const swingShot = active.compiledPoint.point.shots
    .slice(0, active.compiledPoint.point.decisiveShotIndex + 1)
    .filter((shot) => shot.by === side)
    .map((shot) => ({ shot, distance: Math.abs(mediaTime - shot.t) }))
    .filter(({ distance }) => distance <= SWING_HALF_WINDOW)
    .sort((a, b) => a.distance - b.distance)[0]?.shot;

  if (!swingShot) {
    return {
      contactPosition: undefined,
      swingPhase: 'ready',
      swingProgress: 0,
      swingShot: undefined,
    };
  }

  const delta = mediaTime - swingShot.t;
  const swingProgress = smoothstep(
    (delta + SWING_HALF_WINDOW) / (SWING_HALF_WINDOW * 2),
  );
  const swingPhase: SwingPhase =
    delta < -FORWARD_SWING_LEAD
      ? 'backswing'
      : delta < 0
        ? 'forward-swing'
        : 'follow-through';

  return {
    contactPosition: swingShot.from,
    swingPhase,
    swingProgress,
    swingShot,
  };
}

export function getPlayerPoseAtTime(
  side: ShotPlayerSide,
  mediaTime: number,
  compiled: CompiledTennisMatch,
): PlayerPose {
  assertFiniteMediaTime(mediaTime);
  const active = getActivePointAtTime(mediaTime, compiled);
  if (!active) {
    return {
      side,
      position: BASELINE_READY_POSITIONS[side],
      contactPosition: undefined,
      swingPhase: 'ready',
      swingProgress: 0,
      swingShot: undefined,
      active: false,
    };
  }

  const swing = swingAtTime(side, mediaTime, active);
  return {
    side,
    position: samplePlayerPosition(side, mediaTime, active),
    ...swing,
    active: true,
  };
}

export function getBallPoseFromTimeSource(
  timeSource: MatchTimeSource,
  compiled: CompiledTennisMatch,
): BallPose {
  return getBallPoseAtTime(timeSource.current, compiled);
}

export function getPlayerPoseFromTimeSource(
  side: ShotPlayerSide,
  timeSource: MatchTimeSource,
  compiled: CompiledTennisMatch,
): PlayerPose {
  return getPlayerPoseAtTime(side, timeSource.current, compiled);
}
