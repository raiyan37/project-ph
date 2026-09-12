import { describe, expect, it } from 'vitest';
import {
  POV_MANIFEST_URL,
  getPovSampleTime,
  resolveStreamMedia,
  type StreamPovManifest,
} from './streamMedia';

const YOUTUBE_ID = 'DHo1mw7lj3s';

const MANIFEST: StreamPovManifest = {
  rgbUrl: '/tennis/pov/rgb.mp4',
  depthUrl: '/tennis/pov/depth.webm',
  fps: 15,
  width: 640,
  height: 360,
  depthScale: 0.001,
  K: [600, 600, 320, 180],
  tracks: [],
};

describe('resolveStreamMedia', () => {
  it('drives the broadcast from the reconstructed RGB clip when a POV manifest is present', () => {
    expect(resolveStreamMedia(MANIFEST, YOUTUBE_ID)).toEqual({
      videoSrc: '/tennis/pov/rgb.mp4',
    });
  });

  it('falls back to YouTube when no reconstructed clip is available', () => {
    expect(resolveStreamMedia(null, YOUTUBE_ID)).toEqual({
      youtubeId: YOUTUBE_ID,
    });
  });

  it('exposes the public manifest URL used by the stream', () => {
    expect(POV_MANIFEST_URL).toBe('/tennis/pov/manifest.json');
  });
});

describe('getPovSampleTime', () => {
  it('equals the local video clock rather than authored Hawk-Eye windows', () => {
    expect(getPovSampleTime(20.4)).toBe(20.4);
    expect(getPovSampleTime(0)).toBe(0);
  });

  it('clamps negative media time to zero without snapping to a scripted point', () => {
    expect(getPovSampleTime(-0.4)).toBe(0);
  });

  it('rejects non-finite video time', () => {
    expect(() => getPovSampleTime(Number.NaN)).toThrow(
      /POV sample time must be finite/,
    );
  });
});
