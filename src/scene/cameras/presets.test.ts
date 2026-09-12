import { describe, expect, it } from 'vitest';
import { HALF_LENGTH } from '../../lib/tennis/court';
import {
  PRESET_CAMERAS,
  PRESET_CAMERA_IDS,
  getPresetCamera,
} from './presets';

describe('preset cameras', () => {
  it('exposes the six broadcast jumps from the plan', () => {
    expect(PRESET_CAMERA_IDS).toEqual([
      'umpire',
      'net',
      'near-baseline',
      'far-baseline',
      'overhead',
      'broadcast',
    ]);
  });

  it('places each preset on the real court', () => {
    const umpire = getPresetCamera('umpire');
    expect(umpire.position[1]).toBeGreaterThan(3);
    expect(Math.abs(umpire.position[2])).toBeLessThan(2);

    const net = getPresetCamera('net');
    expect(net.position[1]).toBeGreaterThan(0.8);
    expect(Math.abs(net.position[2])).toBeLessThan(1);

    expect(getPresetCamera('near-baseline').position[2]).toBeLessThan(
      -HALF_LENGTH,
    );
    expect(getPresetCamera('far-baseline').position[2]).toBeGreaterThan(
      HALF_LENGTH,
    );

    const overhead = getPresetCamera('overhead');
    expect(overhead.position[1]).toBeGreaterThan(16);
    expect(overhead.position[0]).toBeCloseTo(0, 5);
    expect(overhead.position[2]).toBeCloseTo(0, 5);
  });

  it('keeps a labelled chip for every preset', () => {
    PRESET_CAMERA_IDS.forEach((id) => {
      expect(PRESET_CAMERAS[id].label.trim().length).toBeGreaterThan(0);
      expect(PRESET_CAMERAS[id].fov).toBeGreaterThan(20);
    });
  });
});
