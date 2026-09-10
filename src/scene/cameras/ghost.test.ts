import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GHOST_POSE,
  applyGhostLook,
  ghostLookTarget,
  integrateGhost,
} from './ghost';

describe('integrateGhost', () => {
  it('flies forward in the look direction on W', () => {
    const next = integrateGhost(
      { ...DEFAULT_GHOST_POSE, position: [0, 2, 0], yaw: 0, pitch: 0 },
      { forward: 1, right: 0, up: 0, sprint: false },
      1,
    );

    expect(next.position[2]).toBeGreaterThan(0);
    expect(next.position[0]).toBeCloseTo(0, 5);
  });

  it('strafes right on D and climbs on E', () => {
    const next = integrateGhost(
      DEFAULT_GHOST_POSE,
      { forward: 0, right: 1, up: 1, sprint: false },
      1,
    );

    expect(next.position[0]).toBeGreaterThan(DEFAULT_GHOST_POSE.position[0]);
    expect(next.position[1]).toBeGreaterThan(DEFAULT_GHOST_POSE.position[1]);
  });

  it('sprints faster with shift', () => {
    const walk = integrateGhost(DEFAULT_GHOST_POSE, {
      forward: 1,
      right: 0,
      up: 0,
      sprint: false,
    }, 1);
    const sprint = integrateGhost(DEFAULT_GHOST_POSE, {
      forward: 1,
      right: 0,
      up: 0,
      sprint: true,
    }, 1);

    const walkDistance = Math.hypot(
      walk.position[0] - DEFAULT_GHOST_POSE.position[0],
      walk.position[2] - DEFAULT_GHOST_POSE.position[2],
    );
    const sprintDistance = Math.hypot(
      sprint.position[0] - DEFAULT_GHOST_POSE.position[0],
      sprint.position[2] - DEFAULT_GHOST_POSE.position[2],
    );
    expect(sprintDistance).toBeGreaterThan(walkDistance * 1.5);
  });
});

describe('applyGhostLook', () => {
  it('yaws and pitches from mouse or arrow deltas', () => {
    const next = applyGhostLook(DEFAULT_GHOST_POSE, 0.5, 0.2);

    expect(next.yaw).toBeGreaterThan(DEFAULT_GHOST_POSE.yaw);
    expect(next.pitch).toBeGreaterThan(DEFAULT_GHOST_POSE.pitch);
  });

  it('clamps pitch so the camera cannot flip', () => {
    const next = applyGhostLook(DEFAULT_GHOST_POSE, 0, 20);

    expect(next.pitch).toBeLessThanOrEqual(Math.PI / 2 - 0.05);
  });
});

describe('ghostLookTarget', () => {
  it('aims a point ahead of the current pose', () => {
    const pose = { ...DEFAULT_GHOST_POSE, yaw: 0, pitch: 0 };
    const target = ghostLookTarget(pose);

    expect(target[2]).toBeGreaterThan(pose.position[2]);
  });
});
