export const POV_MANIFEST_URL = '/tennis/pov/manifest.json';

export type StreamPovManifest = {
  readonly rgbUrl: string;
  readonly depthUrl: string;
  readonly fps: number;
  readonly width: number;
  readonly height: number;
  readonly depthScale: number;
  readonly K: readonly [number, number, number, number];
  readonly tracks: readonly unknown[];
};

export type StreamMedia =
  | { readonly videoSrc: string; readonly youtubeId?: never }
  | { readonly youtubeId: string; readonly videoSrc?: never };

export function resolveStreamMedia(
  manifest: StreamPovManifest | null,
  youtubeId: string,
): StreamMedia {
  if (manifest?.rgbUrl) {
    return { videoSrc: manifest.rgbUrl };
  }
  return { youtubeId };
}

export function getPovSampleTime(videoCurrentTime: number): number {
  if (!Number.isFinite(videoCurrentTime)) {
    throw new Error('POV sample time must be finite.');
  }
  return Math.max(0, videoCurrentTime);
}
