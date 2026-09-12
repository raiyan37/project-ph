import type { Vec3 } from '../../lib/tennis/court';

export type CameraIntrinsics = readonly [
  fx: number,
  fy: number,
  cx: number,
  cy: number,
];

export interface PovPlayerSample {
  readonly pixel: readonly [number, number];
  readonly position: Vec3;
}

export interface PovTrackSample {
  readonly t: number;
  readonly near?: PovPlayerSample | null;
  readonly far?: PovPlayerSample | null;
}

export interface PovManifest {
  readonly rgbUrl: string;
  readonly depthUrl: string;
  readonly fps: number;
  readonly width: number;
  readonly height: number;
  readonly depthScale: number;
  readonly K: CameraIntrinsics;
  readonly tracks: readonly PovTrackSample[];
  readonly hideRadius?: number;
  readonly eyeHeight?: number;
}

export type PovTrackPose =
  | { readonly standby: true }
  | {
      readonly standby: false;
      readonly position: Vec3;
      readonly pixel: readonly [number, number];
      readonly lookAt: Vec3;
    };
