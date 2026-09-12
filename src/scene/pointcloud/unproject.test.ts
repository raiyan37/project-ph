import { describe, expect, it } from 'vitest';
import {
  packDepthMetres,
  unpackDepthFromRg,
  unpackDepthMetres,
  packDepthToRg,
  projectPoint,
  unprojectPixel,
} from './unproject';

const K = [500, 500, 320, 180] as const;
const DEPTH_SCALE = 0.001;

describe('depth packing', () => {
  it('round-trips metres through uint16 millimetre packing', () => {
    const packed = packDepthMetres(4.25, DEPTH_SCALE);
    expect(unpackDepthMetres(packed, DEPTH_SCALE)).toBeCloseTo(4.25, 3);
  });

  it('stores 16-bit depth in RG channels for a video texture', () => {
    const packed = packDepthMetres(12.5, DEPTH_SCALE);
    const rg = packDepthToRg(packed);
    expect(unpackDepthFromRg(rg.r, rg.g, DEPTH_SCALE)).toBeCloseTo(12.5, 3);
  });

  it('treats a zero payload as invalid depth', () => {
    expect(unpackDepthMetres(0, DEPTH_SCALE)).toBe(0);
    expect(unpackDepthFromRg(0, 0, DEPTH_SCALE)).toBe(0);
  });
});

describe('unprojectPixel', () => {
  it('places the principal point on the camera forward axis in Three.js space', () => {
    const point = unprojectPixel(320, 180, 5, K);
    expect(point[0]).toBeCloseTo(0, 8);
    expect(point[1]).toBeCloseTo(0, 8);
    expect(point[2]).toBeCloseTo(-5, 8);
  });

  it('maps a pixel right of center to +X and down of center to -Y', () => {
    const point = unprojectPixel(420, 230, 10, K);
    expect(point[0]).toBeCloseTo(((420 - 320) / 500) * 10, 8);
    expect(point[1]).toBeCloseTo(-((230 - 180) / 500) * 10, 8);
    expect(point[2]).toBeCloseTo(-10, 8);
  });

  it('round-trips through projectPoint', () => {
    const original: readonly [number, number, number] = [1.2, 0.4, -6];
    const projected = projectPoint(original, K);
    const restored = unprojectPixel(
      projected.u,
      projected.v,
      projected.depth,
      K,
    );
    expect(restored[0]).toBeCloseTo(original[0], 8);
    expect(restored[1]).toBeCloseTo(original[1], 8);
    expect(restored[2]).toBeCloseTo(original[2], 8);
  });

  it('returns the origin for invalid depth', () => {
    expect(unprojectPixel(320, 180, 0, K)).toEqual([0, 0, 0]);
  });
});
