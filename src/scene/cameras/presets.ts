import { HALF_LENGTH } from '../../lib/tennis/court';
import type { Vec3 } from '../../lib/tennis/court';

export type PresetCameraId =
  | 'umpire'
  | 'net'
  | 'near-baseline'
  | 'far-baseline'
  | 'overhead'
  | 'broadcast';

export interface PresetCamera {
  readonly id: PresetCameraId;
  readonly label: string;
  readonly shortcut: string;
  readonly position: Vec3;
  readonly target: Vec3;
  readonly fov: number;
}

export const PRESET_CAMERA_IDS: readonly PresetCameraId[] = [
  'umpire',
  'net',
  'near-baseline',
  'far-baseline',
  'overhead',
  'broadcast',
] as const;

export const PRESET_CAMERAS: Readonly<Record<PresetCameraId, PresetCamera>> = {
  umpire: {
    id: 'umpire',
    label: 'Umpire',
    shortcut: '1',
    position: [8.6, 3.85, 0],
    target: [0, 1.05, 0],
    fov: 48,
  },
  net: {
    id: 'net',
    label: 'Net cam',
    shortcut: '2',
    position: [0.05, 1.12, 0.18],
    target: [0, 1.05, 8],
    fov: 68,
  },
  'near-baseline': {
    id: 'near-baseline',
    label: 'Near baseline',
    shortcut: '3',
    position: [0, 1.65, -(HALF_LENGTH + 2.6)],
    target: [0, 1.05, 2],
    fov: 52,
  },
  'far-baseline': {
    id: 'far-baseline',
    label: 'Far baseline',
    shortcut: '4',
    position: [0, 1.65, HALF_LENGTH + 2.6],
    target: [0, 1.05, -2],
    fov: 52,
  },
  overhead: {
    id: 'overhead',
    label: 'Overhead',
    shortcut: '5',
    position: [0, 22, 0],
    target: [0, 0, 0],
    fov: 48,
  },
  broadcast: {
    id: 'broadcast',
    label: 'Broadcast',
    shortcut: '6',
    position: [10, 18, -27],
    target: [0, 0.8, 1],
    fov: 45,
  },
};

export function getPresetCamera(id: PresetCameraId): PresetCamera {
  const preset = PRESET_CAMERAS[id];
  if (!preset) {
    throw new Error(`Unknown preset camera "${id}".`);
  }
  return preset;
}
