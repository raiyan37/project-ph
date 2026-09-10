import { describe, expect, it } from 'vitest';
import { getCompiledTennisMatch } from '../../data/tennis/match';
import {
  getBallPoseAtTime,
  getPlayerPoseAtTime,
} from '../../lib/tennis/animation';
import { getPlayerPOVCameraPose } from './PlayerPOVCamera';

const compiled = getCompiledTennisMatch();

describe('getPlayerPOVCameraPose', () => {
  it('mirrors the neutral near and far framing across the net', () => {
    const near = getPlayerPOVCameraPose('near', 0, compiled);
    const far = getPlayerPOVCameraPose('far', 0, compiled);

    expect(near.position[0]).toBeCloseTo(far.position[0], 8);
    expect(near.position[1]).toBeCloseTo(far.position[1], 8);
    expect(near.position[2]).toBeCloseTo(-far.position[2], 8);
    expect(near.target[0]).toBeCloseTo(far.target[0], 8);
    expect(near.target[1]).toBeCloseTo(far.target[1], 8);
    expect(near.target[2]).toBeCloseTo(-far.target[2], 8);
  });

  it('returns finite camera coordinates throughout active and idle media', () => {
    for (const side of ['near', 'far'] as const) {
      for (const mediaTime of [0, 13, 15.4, 38.4, 56.5, 85.95, 704]) {
        const pose = getPlayerPOVCameraPose(side, mediaTime, compiled);

        expect([...pose.position, ...pose.target].every(Number.isFinite)).toBe(
          true,
        );
      }
    }
  });

  it('targets the live ball when it is visible', () => {
    const mediaTime = 14;
    const ball = getBallPoseAtTime(mediaTime, compiled);
    const pose = getPlayerPOVCameraPose('near', mediaTime, compiled);

    expect(ball.visible).toBe(true);
    expect(pose.target[0]).toBeCloseTo(ball.position[0], 8);
    expect(pose.target[1]).toBeCloseTo(ball.position[1], 8);
    expect(pose.target[2]).toBeCloseTo(ball.position[2], 8);
  });

  it('falls back toward court center and the opponent side when play is idle', () => {
    const near = getPlayerPOVCameraPose('near', 0, compiled);
    const far = getPlayerPOVCameraPose('far', 0, compiled);

    expect(near.target[2]).toBeGreaterThan(0);
    expect(near.target[2]).toBeGreaterThan(near.position[2]);
    expect(far.target[2]).toBeLessThan(0);
    expect(far.target[2]).toBeLessThan(far.position[2]);
  });

  it('anchors the camera eye 1.7 metres above the player pose', () => {
    const mediaTime = 14;
    const player = getPlayerPoseAtTime('near', mediaTime, compiled);
    const pose = getPlayerPOVCameraPose('near', mediaTime, compiled);

    expect(pose.position[1] - player.position[1]).toBeCloseTo(1.7, 8);
  });
});
