import { describe, expect, it } from 'vitest';
import { interpolatePovTrack } from './tracks';
import type { PovTrackSample } from './types';

const tracks: readonly PovTrackSample[] = [
  {
    t: 10,
    near: { pixel: [200, 300], position: [0.2, -0.1, -4] },
    far: { pixel: [400, 120], position: [1.1, 0.4, -12] },
  },
  {
    t: 12,
    near: { pixel: [220, 310], position: [0.4, -0.2, -4.2] },
    far: { pixel: [410, 110], position: [1.3, 0.5, -12.4] },
  },
];

describe('interpolatePovTrack', () => {
  it('returns standby when no samples exist for that side at the video clock', () => {
    expect(interpolatePovTrack(tracks, 1, 'near').standby).toBe(true);
    expect(interpolatePovTrack([], 11, 'near').standby).toBe(true);
  });

  it('lerps the reconstructed player between neighboring video-clock samples', () => {
    const pose = interpolatePovTrack(tracks, 11, 'near');
    expect(pose.standby).toBe(false);
    if (pose.standby) {
      return;
    }
    expect(pose.position[0]).toBeCloseTo(0.3, 8);
    expect(pose.position[1]).toBeCloseTo(-0.15, 8);
    expect(pose.position[2]).toBeCloseTo(-4.1, 8);
    expect(pose.pixel[0]).toBeCloseTo(210, 8);
    expect(pose.pixel[1]).toBeCloseTo(305, 8);
  });

  it('looks at the opponent when that side is also tracked', () => {
    const pose = interpolatePovTrack(tracks, 10, 'near');
    expect(pose.standby).toBe(false);
    if (pose.standby) {
      return;
    }
    expect(pose.lookAt[0]).toBeCloseTo(1.1, 8);
    expect(pose.lookAt[1]).toBeCloseTo(0.4, 8);
    expect(pose.lookAt[2]).toBeCloseTo(-12, 8);
  });

  it('samples at the video time even when no authored tennis point is active', () => {
    const pose = interpolatePovTrack(tracks, 11.5, 'far');
    expect(pose.standby).toBe(false);
  });
});
