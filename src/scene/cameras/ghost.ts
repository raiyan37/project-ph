import type { Vec3 } from '../../lib/tennis/court';

export interface GhostPose {
  readonly position: Vec3;
  readonly yaw: number;
  readonly pitch: number;
}

export interface GhostMoveInput {
  readonly forward: number;
  readonly right: number;
  readonly up: number;
  readonly sprint: boolean;
}

export const DEFAULT_GHOST_POSE: GhostPose = {
  position: [7.5, 2.2, -16],
  yaw: 0.35,
  pitch: -0.12,
};

export const GHOST_WALK_SPEED = 4.2;
export const GHOST_SPRINT_SPEED = 10.5;
export const GHOST_VERTICAL_SPEED = 3.4;
const MAX_PITCH = Math.PI / 2 - 0.05;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function lookDirection(pose: GhostPose): Vec3 {
  const cosPitch = Math.cos(pose.pitch);
  return [
    Math.sin(pose.yaw) * cosPitch,
    Math.sin(pose.pitch),
    Math.cos(pose.yaw) * cosPitch,
  ];
}

export function ghostLookTarget(pose: GhostPose, distance = 4): Vec3 {
  const direction = lookDirection(pose);
  return [
    pose.position[0] + direction[0] * distance,
    pose.position[1] + direction[1] * distance,
    pose.position[2] + direction[2] * distance,
  ];
}

export function applyGhostLook(
  pose: GhostPose,
  deltaYaw: number,
  deltaPitch: number,
): GhostPose {
  if (!Number.isFinite(deltaYaw) || !Number.isFinite(deltaPitch)) {
    throw new Error('Ghost look deltas must be finite.');
  }
  return {
    ...pose,
    yaw: pose.yaw + deltaYaw,
    pitch: clamp(pose.pitch + deltaPitch, -MAX_PITCH, MAX_PITCH),
  };
}

export function integrateGhost(
  pose: GhostPose,
  input: GhostMoveInput,
  deltaSeconds: number,
): GhostPose {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new Error('Ghost integration delta must be a finite non-negative number.');
  }
  const speed = input.sprint ? GHOST_SPRINT_SPEED : GHOST_WALK_SPEED;
  const forwardX = Math.sin(pose.yaw);
  const forwardZ = Math.cos(pose.yaw);
  const rightX = Math.cos(pose.yaw);
  const rightZ = -Math.sin(pose.yaw);
  const moveScale = speed * deltaSeconds;
  const climb = input.up * GHOST_VERTICAL_SPEED * deltaSeconds;

  return {
    ...pose,
    position: [
      pose.position[0] + forwardX * input.forward * moveScale + rightX * input.right * moveScale,
      Math.max(0.35, pose.position[1] + climb),
      pose.position[2] + forwardZ * input.forward * moveScale + rightZ * input.right * moveScale,
    ],
  };
}
