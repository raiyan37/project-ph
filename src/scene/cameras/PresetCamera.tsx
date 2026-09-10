import { getPresetCamera, type PresetCameraId } from './presets';
import { LookAtCamera } from './LookAtCamera';

export interface PresetCameraRigProps {
  presetId: PresetCameraId;
}

export function PresetCameraRig({ presetId }: PresetCameraRigProps) {
  const preset = getPresetCamera(presetId);
  return (
    <LookAtCamera
      position={preset.position}
      target={preset.target}
      fov={preset.fov}
    />
  );
}
