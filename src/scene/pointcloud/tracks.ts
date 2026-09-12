import type { Vec3 } from '../../lib/tennis/court';
import { getPovSampleTime } from '../../lib/tennis/streamMedia';
import type {
  PovPlayerSample,
  PovTrackPose,
  PovTrackSample,
} from './types';
import type { ShotPlayerSide } from '../../lib/tennis/trajectory';

const SAMPLE_HOLD_SECONDS = 0.35;

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function lerpVec3(from: Vec3, to: Vec3, amount: number): Vec3 {
  return [
    lerp(from[0], to[0], amount),
    lerp(from[1], to[1], amount),
    lerp(from[2], to[2], amount),
  ];
}

function lerpPixel(
  from: readonly [number, number],
  to: readonly [number, number],
  amount: number,
): readonly [number, number] {
  return [lerp(from[0], to[0], amount), lerp(from[1], to[1], amount)];
}

function sampleOnSide(
  sample: PovTrackSample,
  side: ShotPlayerSide,
): PovPlayerSample | null | undefined {
  return sample[side];
}

function fallbackLookAt(position: Vec3): Vec3 {
  return [position[0], position[1], position[2] - 4];
}

export function interpolatePovTrack(
  tracks: readonly PovTrackSample[],
  mediaTime: number,
  side: ShotPlayerSide,
): PovTrackPose {
  const time = getPovSampleTime(mediaTime);
  if (tracks.length === 0) {
    return { standby: true };
  }

  let laterIndex = tracks.findIndex((sample) => sample.t >= time);
  if (laterIndex === -1) {
    laterIndex = tracks.length;
  }

  const later = tracks[laterIndex];
  const earlier = tracks[laterIndex - 1];

  if (later && sampleOnSide(later, side) && Math.abs(later.t - time) < 1e-6) {
    return poseFromSample(later, side, later);
  }

  if (earlier && later) {
    const from = sampleOnSide(earlier, side);
    const to = sampleOnSide(later, side);
    if (from && to) {
      const span = later.t - earlier.t;
      const amount = span <= 0 ? 0 : (time - earlier.t) / span;
      const opponent = interpolateOpponent(earlier, later, side, amount);
      return {
        standby: false,
        position: lerpVec3(from.position, to.position, amount),
        pixel: lerpPixel(from.pixel, to.pixel, amount),
        lookAt: opponent ?? fallbackLookAt(lerpVec3(from.position, to.position, amount)),
      };
    }
  }

  const held = nearestHeldSample(tracks, laterIndex, time, side);
  if (!held) {
    return { standby: true };
  }
  return poseFromSample(held, side, held);
}

function interpolateOpponent(
  earlier: PovTrackSample,
  later: PovTrackSample,
  side: ShotPlayerSide,
  amount: number,
): Vec3 | undefined {
  const other: ShotPlayerSide = side === 'near' ? 'far' : 'near';
  const from = sampleOnSide(earlier, other);
  const to = sampleOnSide(later, other);
  if (from && to) {
    return lerpVec3(from.position, to.position, amount);
  }
  return from?.position ?? to?.position;
}

function nearestHeldSample(
  tracks: readonly PovTrackSample[],
  laterIndex: number,
  time: number,
  side: ShotPlayerSide,
): PovTrackSample | undefined {
  const earlier = tracks[laterIndex - 1];
  const later = tracks[laterIndex];
  const candidates = [earlier, later].filter((sample): sample is PovTrackSample => {
    return Boolean(sample && sampleOnSide(sample, side));
  });
  const held = candidates.find(
    (sample) => Math.abs(sample.t - time) <= SAMPLE_HOLD_SECONDS,
  );
  return held;
}

function poseFromSample(
  sample: PovTrackSample,
  side: ShotPlayerSide,
  lookSource: PovTrackSample,
): PovTrackPose {
  const player = sampleOnSide(sample, side);
  if (!player) {
    return { standby: true };
  }
  const other: ShotPlayerSide = side === 'near' ? 'far' : 'near';
  const opponent = sampleOnSide(lookSource, other);
  return {
    standby: false,
    position: player.position,
    pixel: player.pixel,
    lookAt: opponent?.position ?? fallbackLookAt(player.position),
  };
}
