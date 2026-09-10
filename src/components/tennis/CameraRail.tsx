import {
  PRESET_CAMERA_IDS,
  PRESET_CAMERAS,
  type PresetCameraId,
} from '../../scene/cameras/presets';
import './tennis-shell.css';

export interface CameraRailProps {
  activePreset: PresetCameraId | null;
  placementActive: boolean;
  ghostActive: boolean;
  onSelectPreset: (id: PresetCameraId) => void;
  onTogglePlacement: () => void;
  onToggleGhost: () => void;
}

export function CameraRail({
  activePreset,
  placementActive,
  ghostActive,
  onSelectPreset,
  onTogglePlacement,
  onToggleGhost,
}: CameraRailProps) {
  return (
    <nav className="camera-rail" aria-label="Court cameras">
      <span className="camera-rail__kicker">Lenses</span>
      {PRESET_CAMERA_IDS.map((id) => {
        const preset = PRESET_CAMERAS[id];
        return (
          <button
            key={id}
            type="button"
            className={`camera-rail__chip${activePreset === id ? ' is-active' : ''}`}
            aria-pressed={activePreset === id}
            aria-keyshortcuts={preset.shortcut}
            onClick={() => onSelectPreset(id)}
          >
            {preset.label}
            <span className="sr-only">{` Shortcut ${preset.shortcut}`}</span>
          </button>
        );
      })}
      <span className="camera-rail__split" aria-hidden="true" />
      <button
        type="button"
        className={`camera-rail__action${placementActive ? ' is-active' : ''}`}
        aria-pressed={placementActive}
        aria-keyshortcuts="P"
        onClick={onTogglePlacement}
      >
        Place
      </button>
      <button
        type="button"
        className={`camera-rail__action${ghostActive ? ' is-active' : ''}`}
        aria-pressed={ghostActive}
        aria-keyshortcuts="G"
        onClick={onToggleGhost}
      >
        Ghost
      </button>
    </nav>
  );
}
