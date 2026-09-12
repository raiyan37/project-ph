import {
  BALL_RADIUS,
  HALF_LENGTH,
  SINGLES_HALF_WIDTH,
  isInBounds,
  netHeightAt,
  type Vec3,
} from './court';

export const DEFAULT_INTEGRATION_STEP = 1 / 120;
export const GRAVITY = 9.81;
export const DRAG_COEFFICIENT = 0.0024;
export const MAGNUS_COEFFICIENT = 0.0012;
export const BOUNCE_RESTITUTION = 0.72;
export const BOUNCE_HORIZONTAL_FRICTION = 0.82;

const DEFAULT_MAX_FLIGHT_TIME = 12;
const DEFAULT_POST_BOUNCE_DURATION = 1.25;
const MIN_ELEVATION = (-89.5 * Math.PI) / 180;
const MAX_ELEVATION = (89.5 * Math.PI) / 180;
const COARSE_ELEVATION_SCAN_STEP = (2 * Math.PI) / 180;
const RANGE_SOLVE_TOLERANCE = 1e-7;
const BOUNDARY_NUMERICAL_TOLERANCE = 1e-6;
const GROUND_TIME_EPSILON = 1e-12;
const RESTING_VERTICAL_SPEED = 0.12;
const MAX_GROUND_COLLISIONS_PER_STEP = 16;
const BISECTION_ITERATIONS = 60;
const MAXIMUM_REFINEMENT_ITERATIONS = 60;

export type ShotPlayerSide = 'near' | 'far';
export type ShotType = 'serve' | 'forehand' | 'backhand' | 'volley';
export type ShotSpin = 'flat' | 'topspin' | 'slice';
export type Vec2 = readonly [number, number];

export interface Shot {
  /** Absolute media time, in seconds, when racket contact occurs. */
  readonly t: number;
  readonly by: ShotPlayerSide;
  readonly type: ShotType;
  /** Ball-center position [x, y, z] in metres at contact. */
  readonly from: Vec3;
  /** Authored first-bounce ground target [x, z] in metres. */
  readonly to: Vec2;
  /** Racket-contact speed in metres per second. */
  readonly speed: number;
  readonly spin: ShotSpin;
}

export interface TrajectoryOptions {
  /** Maximum time allowed while finding the first ground contact. */
  readonly maxFlightTime?: number;
  /** Time to continue integrating after the solved first bounce. */
  readonly postBounceDuration?: number;
}

export interface TrajectorySample {
  /** Absolute media time in seconds. */
  readonly t: number;
  /** Seconds elapsed since racket contact. */
  readonly elapsed: number;
  readonly position: Vec3;
  readonly velocity: Vec3;
}

export interface NetCrossing {
  /** Absolute media time at the interpolated z=0 crossing. */
  readonly t: number;
  readonly elapsed: number;
  readonly x: number;
  readonly centerHeight: number;
  readonly tapeHeight: number;
  /**
   * Ball-surface clearance over the local tape:
   * centerHeight - BALL_RADIUS - netHeightAt(x).
   * Negative values indicate a net/tape intersection.
   */
  readonly surfaceClearance: number;
}

export interface Bounce {
  /** Absolute media time at the interpolated ground contact. */
  readonly t: number;
  readonly elapsed: number;
  /** Ball-center position; y is exactly BALL_RADIUS. */
  readonly position: Vec3;
  readonly incomingVelocity: Vec3;
  readonly outgoingVelocity: Vec3;
  readonly inBounds: boolean;
  /** Signed distance to the nearest singles boundary, in metres. */
  readonly singlesMargin: number;
}

export interface Trajectory {
  readonly shot: Shot;
  readonly step: number;
  readonly duration: number;
  /** Solved launch elevation in radians. */
  readonly launchElevation: number;
  readonly launchVelocity: Vec3;
  readonly landingError: number;
  readonly samples: readonly TrajectorySample[];
  readonly netCrossing: NetCrossing | undefined;
  readonly bounces: readonly Bounce[];
}

interface PhysicsContext {
  readonly angularVelocity: Vec3;
}

interface State {
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly resting: boolean;
}

interface FreeFlightSegment {
  readonly from: State;
  readonly to: State;
  readonly fromElapsed: number;
  readonly duration: number;
}

interface FirstBounce {
  readonly elapsed: number;
  readonly position: Vec3;
  readonly incomingVelocity: Vec3;
}

interface ElevationEvaluation {
  readonly elevation: number;
  readonly objective: number;
  readonly bounce: FirstBounce;
  readonly launchVelocity: Vec3;
}

interface LaunchSolution {
  readonly elevation: number;
  readonly bounce: FirstBounce;
  readonly launchVelocity: Vec3;
  readonly landingError: number;
}

const SHOT_PLAYER_SIDES: readonly ShotPlayerSide[] = ['near', 'far'];
const SHOT_TYPES: readonly ShotType[] = [
  'serve',
  'forehand',
  'backhand',
  'volley',
];
const SHOT_SPINS: readonly ShotSpin[] = ['flat', 'topspin', 'slice'];

function isFiniteTuple(tuple: readonly number[], length: number): boolean {
  return tuple.length === length && tuple.every(Number.isFinite);
}

function validateShot(shot: Shot): void {
  if (shot === null || typeof shot !== 'object') {
    throw new Error('Trajectory shot must be an object.');
  }
  if (!Number.isFinite(shot.t)) {
    throw new Error('Trajectory shot contact time must be finite.');
  }
  if (!SHOT_PLAYER_SIDES.includes(shot.by)) {
    throw new Error(`Trajectory shot has invalid player side "${shot.by}".`);
  }
  if (!SHOT_TYPES.includes(shot.type)) {
    throw new Error(`Trajectory shot has invalid type "${shot.type}".`);
  }
  if (!SHOT_SPINS.includes(shot.spin)) {
    throw new Error(`Trajectory shot has invalid spin "${shot.spin}".`);
  }
  if (!Array.isArray(shot.from) || !isFiniteTuple(shot.from, 3)) {
    throw new Error('Trajectory shot from must contain three finite numbers.');
  }
  if (!Array.isArray(shot.to) || !isFiniteTuple(shot.to, 2)) {
    throw new Error('Trajectory shot target must contain two finite numbers.');
  }
  if (!Number.isFinite(shot.speed)) {
    throw new Error('Trajectory shot speed must be finite.');
  }
  if (shot.speed <= 0) {
    throw new Error('Trajectory shot speed must be positive.');
  }
  if (shot.from[1] < BALL_RADIUS) {
    throw new Error(
      `Trajectory shot starts below the ground: center y must be at least ${BALL_RADIUS}m.`,
    );
  }
  if (Math.hypot(shot.to[0] - shot.from[0], shot.to[1] - shot.from[2]) <= 1e-6) {
    throw new Error(
      'Trajectory shot target must be horizontally distinct from its origin.',
    );
  }
}

function optionOrDefault(
  value: number | undefined,
  fallback: number,
  name: string,
  allowZero = false,
): number {
  const resolved = value ?? fallback;
  const validSign = allowZero ? resolved >= 0 : resolved > 0;
  if (!Number.isFinite(resolved) || !validSign) {
    throw new Error(
      `Trajectory ${name} must be a finite ${allowZero ? 'non-negative' : 'positive'} number.`,
    );
  }
  return resolved;
}

function lerp(a: number, b: number, amount: number): number {
  return a + (b - a) * amount;
}

function lerpVec3(a: Vec3, b: Vec3, amount: number): Vec3 {
  return [
    lerp(a[0], b[0], amount),
    lerp(a[1], b[1], amount),
    lerp(a[2], b[2], amount),
  ];
}

function assertFiniteState(state: State): void {
  if (
    !state.position.every(Number.isFinite) ||
    !state.velocity.every(Number.isFinite)
  ) {
    throw new Error(
      'Trajectory integration became non-finite; check shot speed and solver options.',
    );
  }
}

/**
 * Uses the empirical Magnus model a_M = C_M * (omega × velocity).
 * omega is perpendicular to the horizontal travel direction: topspin is
 * positive and therefore curves the ball downward, while slice is modeled as
 * moderate backspin and curves it upward. Flat shots use omega=0.
 */
function angularVelocityForSpin(
  spin: ShotSpin,
  directionX: number,
  directionZ: number,
): Vec3 {
  const spinRate = spin === 'topspin' ? 120 : spin === 'slice' ? -70 : 0;
  return [directionZ * spinRate, 0, -directionX * spinRate];
}

function acceleration(velocity: Vec3, context: PhysicsContext): Vec3 {
  const speed = Math.hypot(velocity[0], velocity[1], velocity[2]);
  const dragScale = -DRAG_COEFFICIENT * speed;
  const omega = context.angularVelocity;
  const magnusCross: Vec3 = [
    omega[1] * velocity[2] - omega[2] * velocity[1],
    omega[2] * velocity[0] - omega[0] * velocity[2],
    omega[0] * velocity[1] - omega[1] * velocity[0],
  ];

  return [
    dragScale * velocity[0] + MAGNUS_COEFFICIENT * magnusCross[0],
    -GRAVITY +
      dragScale * velocity[1] +
      MAGNUS_COEFFICIENT * magnusCross[1],
    dragScale * velocity[2] + MAGNUS_COEFFICIENT * magnusCross[2],
  ];
}

function integrateFree(state: State, step: number, context: PhysicsContext): State {
  if (state.resting) {
    return {
      position: [state.position[0], BALL_RADIUS, state.position[2]],
      velocity: [0, 0, 0],
      resting: true,
    };
  }

  const force = acceleration(state.velocity, context);
  const velocity: Vec3 = [
    state.velocity[0] + force[0] * step,
    state.velocity[1] + force[1] * step,
    state.velocity[2] + force[2] * step,
  ];
  const position: Vec3 = [
    state.position[0] +
      state.velocity[0] * step +
      0.5 * force[0] * step * step,
    state.position[1] +
      state.velocity[1] * step +
      0.5 * force[1] * step * step,
    state.position[2] +
      state.velocity[2] * step +
      0.5 * force[2] * step * step,
  ];
  const next = { position, velocity, resting: false };
  assertFiniteState(next);
  return next;
}

function groundCollisionTime(
  state: State,
  maxDuration: number,
  context: PhysicsContext,
): number | undefined {
  if (state.resting) {
    return undefined;
  }

  const height = state.position[1] - BALL_RADIUS;
  const velocityY = state.velocity[1];
  if (height <= GROUND_TIME_EPSILON && velocityY < 0) {
    return 0;
  }

  const accelerationY = acceleration(state.velocity, context)[1];
  const quadratic = 0.5 * accelerationY;
  const roots: number[] = [];
  if (Math.abs(quadratic) <= Number.EPSILON) {
    if (Math.abs(velocityY) > Number.EPSILON) {
      roots.push(-height / velocityY);
    }
  } else {
    const discriminant =
      velocityY * velocityY - 4 * quadratic * height;
    if (discriminant >= 0) {
      const squareRoot = Math.sqrt(discriminant);
      roots.push(
        (-velocityY - squareRoot) / (2 * quadratic),
        (-velocityY + squareRoot) / (2 * quadratic),
      );
    }
  }

  const collision = roots
    .filter(
      (root) =>
        root > GROUND_TIME_EPSILON &&
        root <= maxDuration + GROUND_TIME_EPSILON,
    )
    .sort((a, b) => a - b)[0];
  return collision === undefined
    ? undefined
    : Math.min(collision, maxDuration);
}

function firstBounceForElevation(
  shot: Shot,
  elevation: number,
  directionX: number,
  directionZ: number,
  context: PhysicsContext,
  step: number,
  maxFlightTime: number,
): FirstBounce | undefined {
  const horizontalSpeed = shot.speed * Math.cos(elevation);
  const launchVelocity: Vec3 = [
    directionX * horizontalSpeed,
    shot.speed * Math.sin(elevation),
    directionZ * horizontalSpeed,
  ];
  let state: State = {
    position: shot.from,
    velocity: launchVelocity,
    resting: false,
  };
  let elapsed = 0;

  while (elapsed < maxFlightTime) {
    const remainingAllowed = maxFlightTime - elapsed;
    const integrationDuration = Math.min(step, remainingAllowed);
    if (integrationDuration <= 0) {
      break;
    }
    const collisionTime = groundCollisionTime(
      state,
      integrationDuration,
      context,
    );
    if (collisionTime !== undefined) {
      const impact = integrateFree(state, collisionTime, context);
      const bounceElapsed = elapsed + collisionTime;
      if (bounceElapsed > maxFlightTime + GROUND_TIME_EPSILON) {
        return undefined;
      }
      return {
        elapsed: Math.min(bounceElapsed, maxFlightTime),
        position: [
          impact.position[0],
          BALL_RADIUS,
          impact.position[2],
        ],
        incomingVelocity: impact.velocity,
      };
    }
    state = integrateFree(state, integrationDuration, context);
    elapsed += integrationDuration;
  }

  return undefined;
}

function evaluateElevation(
  shot: Shot,
  elevation: number,
  directionX: number,
  directionZ: number,
  targetDistance: number,
  context: PhysicsContext,
  step: number,
  maxFlightTime: number,
): ElevationEvaluation | undefined {
  const bounce = firstBounceForElevation(
    shot,
    elevation,
    directionX,
    directionZ,
    context,
    step,
    maxFlightTime,
  );
  if (!bounce) {
    return undefined;
  }

  const progress =
    (bounce.position[0] - shot.from[0]) * directionX +
    (bounce.position[2] - shot.from[2]) * directionZ;
  const horizontalSpeed = shot.speed * Math.cos(elevation);

  return {
    elevation,
    objective: progress - targetDistance,
    bounce,
    launchVelocity: [
      directionX * horizontalSpeed,
      shot.speed * Math.sin(elevation),
      directionZ * horizontalSpeed,
    ],
  };
}

function landingError(shot: Shot, bounce: FirstBounce): number {
  return Math.hypot(
    bounce.position[0] - shot.to[0],
    bounce.position[2] - shot.to[1],
  );
}

function solveLaunch(
  shot: Shot,
  directionX: number,
  directionZ: number,
  targetDistance: number,
  context: PhysicsContext,
  step: number,
  maxFlightTime: number,
): LaunchSolution {
  const evaluate = (elevation: number): ElevationEvaluation | undefined =>
    evaluateElevation(
      shot,
      elevation,
      directionX,
      directionZ,
      targetDistance,
      context,
      step,
      maxFlightTime,
    );
  const coarse: ElevationEvaluation[] = [];
  for (
    let elevation = MIN_ELEVATION;
    elevation <= MAX_ELEVATION + Number.EPSILON;
    elevation += COARSE_ELEVATION_SCAN_STEP
  ) {
    const evaluation = evaluate(Math.min(elevation, MAX_ELEVATION));
    if (evaluation) {
      coarse.push(evaluation);
    }
  }

  if (coarse.length === 0) {
    throw new Error(
      `Trajectory target is physically unreachable at ${shot.speed}m/s: ` +
        'no first ground contact was found.',
    );
  }

  let coarseMaximum = coarse[0]!;
  for (const evaluation of coarse.slice(1)) {
    if (evaluation.objective > coarseMaximum.objective) {
      coarseMaximum = evaluation;
    }
  }

  let maximumLeft = Math.max(
    MIN_ELEVATION,
    coarseMaximum.elevation - COARSE_ELEVATION_SCAN_STEP,
  );
  let maximumRight = Math.min(
    MAX_ELEVATION,
    coarseMaximum.elevation + COARSE_ELEVATION_SCAN_STEP,
  );
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  let leftProbe = evaluate(
    maximumRight - (maximumRight - maximumLeft) / goldenRatio,
  );
  let rightProbe = evaluate(
    maximumLeft + (maximumRight - maximumLeft) / goldenRatio,
  );

  for (
    let iteration = 0;
    iteration < MAXIMUM_REFINEMENT_ITERATIONS;
    iteration += 1
  ) {
    if (!leftProbe || !rightProbe) {
      break;
    }
    if (leftProbe.objective < rightProbe.objective) {
      maximumLeft = leftProbe.elevation;
      leftProbe = rightProbe;
      rightProbe = evaluate(
        maximumLeft + (maximumRight - maximumLeft) / goldenRatio,
      );
    } else {
      maximumRight = rightProbe.elevation;
      rightProbe = leftProbe;
      leftProbe = evaluate(
        maximumRight - (maximumRight - maximumLeft) / goldenRatio,
      );
    }
  }

  const refinedMaximum = evaluate((maximumLeft + maximumRight) / 2);
  const maximum = [coarseMaximum, leftProbe, rightProbe, refinedMaximum]
    .filter(
      (evaluation): evaluation is ElevationEvaluation =>
        evaluation !== undefined,
    )
    .reduce((best, evaluation) =>
      evaluation.objective > best.objective ? evaluation : best,
    );
  const maximumRange = maximum.objective + targetDistance;

  if (maximum.objective < -RANGE_SOLVE_TOLERANCE) {
    throw new Error(
      `Trajectory target is physically unreachable at ${shot.speed}m/s: ` +
        `requested first-bounce range ${targetDistance.toFixed(2)}m, ` +
        `maximum simulated range ${maximumRange.toFixed(2)}m.`,
    );
  }
  if (Math.abs(maximum.objective) <= RANGE_SOLVE_TOLERANCE) {
    return {
      elevation: maximum.elevation,
      bounce: maximum.bounce,
      launchVelocity: maximum.launchVelocity,
      landingError: landingError(shot, maximum.bounce),
    };
  }

  const lowerCandidates = coarse.filter(
    (evaluation) =>
      evaluation.elevation < maximum.elevation &&
      evaluation.objective <= 0,
  );
  let lower = lowerCandidates.at(-1);
  if (!lower) {
    throw new Error(
      `Trajectory target is physically unreachable on the low launch branch ` +
        `at ${shot.speed}m/s.`,
    );
  }
  let upper = maximum;
  let solution =
    Math.abs(lower.objective) < Math.abs(upper.objective) ? lower : upper;

  for (let iteration = 0; iteration < BISECTION_ITERATIONS; iteration += 1) {
    const midpoint = evaluate((lower.elevation + upper.elevation) / 2);
    if (!midpoint) {
      throw new Error(
        'Trajectory target became unreachable while bisecting the launch angle.',
      );
    }

    if (Math.abs(midpoint.objective) < Math.abs(solution.objective)) {
      solution = midpoint;
    }
    if (Math.abs(midpoint.objective) <= RANGE_SOLVE_TOLERANCE) {
      solution = midpoint;
      break;
    }
    if (Math.sign(lower.objective) === Math.sign(midpoint.objective)) {
      lower = midpoint;
    } else {
      upper = midpoint;
    }
  }

  return {
    elevation: solution.elevation,
    bounce: solution.bounce,
    launchVelocity: solution.launchVelocity,
    landingError: landingError(shot, solution.bounce),
  };
}

/**
 * Signed Euclidean distance to the singles rectangle boundary.
 * Values within one micrometre of a line are normalized to zero solely to
 * absorb floating-point solve noise in replay line classification.
 */
export function singlesBoundaryMargin(x: number, z: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    throw new Error('Singles boundary coordinates must be finite.');
  }

  const normalizedX =
    Math.abs(Math.abs(x) - SINGLES_HALF_WIDTH) <=
    BOUNDARY_NUMERICAL_TOLERANCE
      ? Math.sign(x) * SINGLES_HALF_WIDTH
      : x;
  const normalizedZ =
    Math.abs(Math.abs(z) - HALF_LENGTH) <=
    BOUNDARY_NUMERICAL_TOLERANCE
      ? Math.sign(z) * HALF_LENGTH
      : z;
  const outsideX = Math.max(
    Math.abs(normalizedX) - SINGLES_HALF_WIDTH,
    0,
  );
  const outsideZ = Math.max(Math.abs(normalizedZ) - HALF_LENGTH, 0);
  if (outsideX > 0 || outsideZ > 0) {
    return -Math.hypot(outsideX, outsideZ);
  }
  return Math.min(
    SINGLES_HALF_WIDTH - Math.abs(normalizedX),
    HALF_LENGTH - Math.abs(normalizedZ),
  );
}

function normalizeBouncePosition(position: Vec3): Vec3 {
  const x =
    Math.abs(Math.abs(position[0]) - SINGLES_HALF_WIDTH) <=
    BOUNDARY_NUMERICAL_TOLERANCE
      ? Math.sign(position[0]) * SINGLES_HALF_WIDTH
      : position[0];
  const z =
    Math.abs(Math.abs(position[2]) - HALF_LENGTH) <=
    BOUNDARY_NUMERICAL_TOLERANCE
      ? Math.sign(position[2]) * HALF_LENGTH
      : position[2];
  return [x, BALL_RADIUS, z];
}

function makeSample(
  shotTime: number,
  elapsed: number,
  state: State,
): TrajectorySample {
  return {
    t: shotTime + elapsed,
    elapsed,
    position: state.position,
    velocity: state.velocity,
  };
}

function interpolateNetCrossing(
  shotTime: number,
  from: State,
  to: State,
  fromElapsed: number,
  duration: number,
): NetCrossing | undefined {
  const crosses =
    (from.position[2] <= 0 && to.position[2] >= 0) ||
    (from.position[2] >= 0 && to.position[2] <= 0);
  if (!crosses || from.position[2] === to.position[2]) {
    return undefined;
  }

  const amount = -from.position[2] / (to.position[2] - from.position[2]);
  if (amount < 0 || amount > 1) {
    return undefined;
  }
  const position = lerpVec3(from.position, to.position, amount);
  const elapsed = fromElapsed + amount * duration;
  const tapeHeight = netHeightAt(position[0]);

  return {
    t: shotTime + elapsed,
    elapsed,
    x: position[0],
    centerHeight: position[1],
    tapeHeight,
    surfaceClearance: position[1] - BALL_RADIUS - tapeHeight,
  };
}

function integrateCollisionAwareStep(
  shot: Shot,
  initialState: State,
  fromElapsed: number,
  step: number,
  context: PhysicsContext,
): {
  readonly state: State;
  readonly segments: readonly FreeFlightSegment[];
  readonly bounces: readonly Bounce[];
} {
  let state = initialState;
  let elapsed = fromElapsed;
  let remaining = step;
  let collisionCount = 0;
  const segments: FreeFlightSegment[] = [];
  const bounces: Bounce[] = [];

  while (remaining > GROUND_TIME_EPSILON && !state.resting) {
    const collisionTime = groundCollisionTime(state, remaining, context);
    if (collisionTime === undefined) {
      const next = integrateFree(state, remaining, context);
      segments.push({
        from: state,
        to: next,
        fromElapsed: elapsed,
        duration: remaining,
      });
      state = next;
      remaining = 0;
      break;
    }

    const rawImpact =
      collisionTime > 0
        ? integrateFree(state, collisionTime, context)
        : state;
    const position = normalizeBouncePosition(rawImpact.position);
    const incomingVelocity = rawImpact.velocity;
    const impact: State = {
      position,
      velocity: incomingVelocity,
      resting: false,
    };
    if (collisionTime > 0) {
      segments.push({
        from: state,
        to: impact,
        fromElapsed: elapsed,
        duration: collisionTime,
      });
    }

    const reboundSpeed =
      Math.abs(incomingVelocity[1]) * BOUNCE_RESTITUTION;
    collisionCount += 1;
    const resting =
      reboundSpeed < RESTING_VERTICAL_SPEED ||
      collisionCount >= MAX_GROUND_COLLISIONS_PER_STEP;
    const outgoingVelocity: Vec3 = resting
      ? [0, 0, 0]
      : [
          incomingVelocity[0] * BOUNCE_HORIZONTAL_FRICTION,
          reboundSpeed,
          incomingVelocity[2] * BOUNCE_HORIZONTAL_FRICTION,
        ];
    const bounceElapsed = elapsed + collisionTime;
    bounces.push({
      t: shot.t + bounceElapsed,
      elapsed: bounceElapsed,
      position,
      incomingVelocity,
      outgoingVelocity,
      inBounds: isInBounds(position[0], position[2]),
      singlesMargin: singlesBoundaryMargin(position[0], position[2]),
    });

    state = { position, velocity: outgoingVelocity, resting };
    elapsed = bounceElapsed;
    remaining = Math.max(0, remaining - collisionTime);
  }

  if (state.resting) {
    state = {
      position: [state.position[0], BALL_RADIUS, state.position[2]],
      velocity: [0, 0, 0],
      resting: true,
    };
  }

  return { state, segments, bounces };
}

function integrateSolvedTrajectory(
  shot: Shot,
  solution: LaunchSolution,
  context: PhysicsContext,
  step: number,
  postBounceDuration: number,
): Pick<Trajectory, 'samples' | 'bounces' | 'netCrossing' | 'duration'> {
  let state: State = {
    position: shot.from,
    velocity: solution.launchVelocity,
    resting: false,
  };
  const samples: TrajectorySample[] = [makeSample(shot.t, 0, state)];
  const bounces: Bounce[] = [];
  let netCrossing: NetCrossing | undefined;
  const totalSteps = Math.ceil(
    (solution.bounce.elapsed + postBounceDuration) / step,
  );

  for (let index = 1; index <= totalSteps; index += 1) {
    const fromElapsed = (index - 1) * step;
    const result = integrateCollisionAwareStep(
      shot,
      state,
      fromElapsed,
      step,
      context,
    );
    state = result.state;
    bounces.push(...result.bounces);
    if (!netCrossing) {
      for (const segment of result.segments) {
        netCrossing = interpolateNetCrossing(
          shot.t,
          segment.from,
          segment.to,
          segment.fromElapsed,
          segment.duration,
        );
        if (netCrossing) {
          break;
        }
      }
    }
    samples.push(makeSample(shot.t, index * step, state));
  }

  return {
    samples,
    bounces,
    netCrossing,
    duration: totalSteps * step,
  };
}

/**
 * Solves a launch angle whose first interpolated ground contact reaches
 * `shot.to`, then integrates a deterministic 3D arc at a fixed time step.
 */
export function solveTrajectory(
  shot: Shot,
  options: TrajectoryOptions = {},
): Trajectory {
  validateShot(shot);
  const step = DEFAULT_INTEGRATION_STEP;
  const maxFlightTime = optionOrDefault(
    options.maxFlightTime,
    DEFAULT_MAX_FLIGHT_TIME,
    'maximum flight time',
  );
  const postBounceDuration = optionOrDefault(
    options.postBounceDuration,
    DEFAULT_POST_BOUNCE_DURATION,
    'post-bounce duration',
    true,
  );
  const deltaX = shot.to[0] - shot.from[0];
  const deltaZ = shot.to[1] - shot.from[2];
  const targetDistance = Math.hypot(deltaX, deltaZ);
  const directionX = deltaX / targetDistance;
  const directionZ = deltaZ / targetDistance;
  const context: PhysicsContext = {
    angularVelocity: angularVelocityForSpin(
      shot.spin,
      directionX,
      directionZ,
    ),
  };
  const solution = solveLaunch(
    shot,
    directionX,
    directionZ,
    targetDistance,
    context,
    step,
    maxFlightTime,
  );
  const integrated = integrateSolvedTrajectory(
    shot,
    solution,
    context,
    step,
    postBounceDuration,
  );

  return {
    shot,
    step,
    duration: integrated.duration,
    launchElevation: solution.elevation,
    launchVelocity: solution.launchVelocity,
    landingError: solution.landingError,
    samples: integrated.samples,
    netCrossing: integrated.netCrossing,
    bounces: integrated.bounces,
  };
}

/**
 * Samples by absolute media time (the same clock as `Shot.t`).
 * Values before contact or after the integrated arc clamp to the endpoints.
 */
export function sampleTrajectoryAt(
  trajectory: Trajectory,
  absoluteTime: number,
): TrajectorySample {
  if (!Number.isFinite(absoluteTime)) {
    throw new Error('Trajectory sample time must be finite.');
  }
  const first = trajectory.samples[0];
  const last = trajectory.samples.at(-1);
  if (!first || !last) {
    throw new Error('Cannot sample an empty trajectory.');
  }
  const exactBounce = trajectory.bounces.find(
    (bounce) => Math.abs(bounce.t - absoluteTime) <= GROUND_TIME_EPSILON,
  );
  if (exactBounce) {
    return {
      t: exactBounce.t,
      elapsed: exactBounce.elapsed,
      position: exactBounce.position,
      velocity: exactBounce.outgoingVelocity,
    };
  }
  if (absoluteTime <= first.t) {
    return first;
  }
  if (absoluteTime >= last.t) {
    return last;
  }

  let low = 0;
  let high = trajectory.samples.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (trajectory.samples[middle]!.t <= absoluteTime) {
      low = middle;
    } else {
      high = middle;
    }
  }

  const from = trajectory.samples[low]!;
  const to = trajectory.samples[high]!;
  const intervalBounces = trajectory.bounces.filter(
    (bounce) => bounce.t > from.t && bounce.t < to.t,
  );
  const previousBounce = [...intervalBounces]
    .reverse()
    .find((bounce) => bounce.t < absoluteTime);
  const nextBounce = intervalBounces.find(
    (bounce) => bounce.t > absoluteTime,
  );
  const interpolationFrom: TrajectorySample = previousBounce
    ? {
        t: previousBounce.t,
        elapsed: previousBounce.elapsed,
        position: previousBounce.position,
        velocity: previousBounce.outgoingVelocity,
      }
    : from;
  const interpolationTo: TrajectorySample = nextBounce
    ? {
        t: nextBounce.t,
        elapsed: nextBounce.elapsed,
        position: nextBounce.position,
        velocity: nextBounce.incomingVelocity,
      }
    : to;
  const amount =
    (absoluteTime - interpolationFrom.t) /
    (interpolationTo.t - interpolationFrom.t);
  return {
    t: lerp(interpolationFrom.t, interpolationTo.t, amount),
    elapsed: lerp(
      interpolationFrom.elapsed,
      interpolationTo.elapsed,
      amount,
    ),
    position: lerpVec3(
      interpolationFrom.position,
      interpolationTo.position,
      amount,
    ),
    velocity: lerpVec3(
      interpolationFrom.velocity,
      interpolationTo.velocity,
      amount,
    ),
  };
}
