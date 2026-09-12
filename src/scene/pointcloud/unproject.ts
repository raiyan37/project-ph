import type { Vec3 } from '../../lib/tennis/court';
import type { CameraIntrinsics } from './types';

const UINT16_MAX = 65535;

export function packDepthMetres(metres: number, depthScale: number): number {
  if (!Number.isFinite(metres) || metres <= 0 || depthScale <= 0) {
    return 0;
  }
  return Math.min(UINT16_MAX, Math.round(metres / depthScale));
}

export function unpackDepthMetres(packed: number, depthScale: number): number {
  if (!Number.isFinite(packed) || packed <= 0 || depthScale <= 0) {
    return 0;
  }
  return packed * depthScale;
}

export function packDepthToRg(packed: number): { r: number; g: number } {
  const value = Math.max(0, Math.min(UINT16_MAX, Math.round(packed)));
  return {
    r: Math.floor(value / 256) / 255,
    g: (value % 256) / 255,
  };
}

export function unpackDepthFromRg(
  r: number,
  g: number,
  depthScale: number,
): number {
  const packed = Math.round(r * 255) * 256 + Math.round(g * 255);
  return unpackDepthMetres(packed, depthScale);
}

/**
 * Unprojects a pixel + metric depth into Three.js camera space
 * (Y up, camera looks down -Z).
 */
export function unprojectPixel(
  u: number,
  v: number,
  depthMetres: number,
  K: CameraIntrinsics,
): Vec3 {
  if (!Number.isFinite(depthMetres) || depthMetres <= 0) {
    return [0, 0, 0];
  }
  const [fx, fy, cx, cy] = K;
  const x = ((u - cx) / fx) * depthMetres;
  const y = ((v - cy) / fy) * depthMetres;
  return [x, -y, -depthMetres];
}

export function projectPoint(
  point: Vec3,
  K: CameraIntrinsics,
): { u: number; v: number; depth: number } {
  const [fx, fy, cx, cy] = K;
  const depth = -point[2];
  if (depth <= 0) {
    return { u: cx, v: cy, depth: 0 };
  }
  return {
    u: (point[0] / depth) * fx + cx,
    v: (-point[1] / depth) * fy + cy,
    depth,
  };
}
