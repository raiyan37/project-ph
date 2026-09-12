import { describe, expect, it } from 'vitest';
import {
  createPlacedCamera,
  intersectGroundPlane,
  placedCameraPose,
  screenRay,
} from './placement';

describe('intersectGroundPlane', () => {
  it('hits y=0 in front of a downward look', () => {
    const hit = intersectGroundPlane([0, 10, -20], [0, -1, 2]);

    expect(hit).toEqual([0, 0, 0]);
  });

  it('returns null for a ray that never meets the ground', () => {
    expect(intersectGroundPlane([0, 2, 0], [1, 0.1, 0])).toBeNull();
    expect(intersectGroundPlane([0, 2, 0], [0, 1, 0])).toBeNull();
  });
});

describe('screenRay', () => {
  it('shoots the camera centre along the look vector', () => {
    const ray = screenRay(0, 0, [0, 10, -20], [0, 0, 0], 50, 16 / 9);
    const hit = intersectGroundPlane(ray.origin, ray.direction);

    expect(hit?.[0]).toBeCloseTo(0, 5);
    expect(hit?.[2]).toBeCloseTo(0, 5);
  });
});

describe('placedCameraPose', () => {
  it('sits at the drop point with the chosen height', () => {
    const camera = createPlacedCamera({
      x: 3,
      z: -4,
      height: 2.4,
      trackBall: false,
    });
    const pose = placedCameraPose(camera, [0, 1, 0]);

    expect(pose.position).toEqual([3, 2.4, -4]);
    expect(pose.target[1]).toBeGreaterThan(0);
    expect(camera.trackBall).toBe(false);
  });

  it('looks at the ball when tracking is on', () => {
    const camera = createPlacedCamera({
      x: 0,
      z: -12,
      height: 1.8,
      trackBall: true,
    });
    const pose = placedCameraPose(camera, [1.5, 0.9, 4]);

    expect(pose.target).toEqual([1.5, 0.9, 4]);
  });
});
