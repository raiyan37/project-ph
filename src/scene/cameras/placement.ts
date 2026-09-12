import type { Vec3 } from '../../lib/tennis/court';

export interface PlacedCamera {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly height: number;
  readonly trackBall: boolean;
  readonly headingTarget: Vec3;
}

export interface Ray {
  readonly origin: Vec3;
  readonly direction: Vec3;
}

export interface PlacedCameraPose {
  readonly position: Vec3;
  readonly target: Vec3;
}

let placedCameraSerial = 0;

function assertFiniteTuple(tuple: readonly number[], length: number, name: string): void {
  if (tuple.length !== length || !tuple.every(Number.isFinite)) {
    throw new Error(`${name} must contain ${length} finite numbers.`);
  }
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(vector: Vec3): Vec3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length <= 1e-8) {
    throw new Error('Cannot normalize a zero-length vector.');
  }
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

export function intersectGroundPlane(
  origin: Vec3,
  direction: Vec3,
): Vec3 | null {
  assertFiniteTuple(origin, 3, 'Ray origin');
  assertFiniteTuple(direction, 3, 'Ray direction');
  if (Math.abs(direction[1]) < 1e-8) {
    return null;
  }
  const time = -origin[1] / direction[1];
  if (time < 0) {
    return null;
  }
  return [
    origin[0] + direction[0] * time,
    0,
    origin[2] + direction[2] * time,
  ];
}

export function screenRay(
  ndcX: number,
  ndcY: number,
  cameraPosition: Vec3,
  cameraTarget: Vec3,
  fovDegrees: number,
  aspect: number,
): Ray {
  if (![ndcX, ndcY, fovDegrees, aspect].every(Number.isFinite)) {
    throw new Error('Screen ray parameters must be finite.');
  }
  if (aspect <= 0 || fovDegrees <= 0) {
    throw new Error('Screen ray fov and aspect must be positive.');
  }
  const forward = normalize(subtract(cameraTarget, cameraPosition));
  const worldUp: Vec3 = [0, 1, 0];
  let right = cross(forward, worldUp);
  if (Math.hypot(right[0], right[1], right[2]) <= 1e-8) {
    right = [1, 0, 0];
  } else {
    right = normalize(right);
  }
  const up = cross(right, forward);
  const tanHalf = Math.tan((fovDegrees * Math.PI) / 180 / 2);
  const direction = normalize([
    forward[0] + right[0] * ndcX * tanHalf * aspect + up[0] * ndcY * tanHalf,
    forward[1] + right[1] * ndcX * tanHalf * aspect + up[1] * ndcY * tanHalf,
    forward[2] + right[2] * ndcX * tanHalf * aspect + up[2] * ndcY * tanHalf,
  ]);
  return { origin: cameraPosition, direction };
}

export function createPlacedCamera(options: {
  x: number;
  z: number;
  height?: number;
  trackBall?: boolean;
}): PlacedCamera {
  if (!Number.isFinite(options.x) || !Number.isFinite(options.z)) {
    throw new Error('Placed camera ground coordinates must be finite.');
  }
  const height = options.height ?? 1.8;
  if (!Number.isFinite(height) || height <= 0) {
    throw new Error('Placed camera height must be a positive finite number.');
  }
  placedCameraSerial += 1;
  return {
    id: `placed-${placedCameraSerial}`,
    x: options.x,
    z: options.z,
    height,
    trackBall: options.trackBall ?? false,
    headingTarget: [0, 1, 0],
  };
}

export function placedCameraPose(
  camera: PlacedCamera,
  ballPosition?: Vec3,
): PlacedCameraPose {
  const position: Vec3 = [camera.x, camera.height, camera.z];
  if (camera.trackBall && ballPosition) {
    return { position, target: ballPosition };
  }
  return { position, target: camera.headingTarget };
}
