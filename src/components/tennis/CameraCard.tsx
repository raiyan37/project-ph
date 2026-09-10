import { useState } from 'react';
import type { CompiledTennisMatch } from '../../data/tennis/match';
import type { MatchTimeSource } from '../../lib/tennis/animation';
import type { PlacedCamera } from '../../scene/cameras/placement';
import { PlacedCameraRig } from '../../scene/cameras/PlacedCamera';
import { PresetCameraRig } from '../../scene/cameras/PresetCamera';
import {
  getPresetCamera,
  type PresetCameraId,
} from '../../scene/cameras/presets';
import { CourtViewport } from '../../scene/SceneRoot';
import './pov-card.css';
import './tennis-shell.css';

interface SharedCardProps {
  timeSource: MatchTimeSource;
  compiledMatch: CompiledTennisMatch;
  index: number;
}

export interface PresetCameraCardProps extends SharedCardProps {
  presetId: PresetCameraId;
}

export function PresetCameraCard({
  presetId,
  timeSource,
  compiledMatch,
  index,
}: PresetCameraCardProps) {
  const [expanded, setExpanded] = useState(false);
  const preset = getPresetCamera(presetId);
  const viewportId = `preset-${presetId}-viewport`;

  return (
    <article
      className={`pov-card camera-card camera-card--preset${expanded ? ' pov-card--expanded' : ''}`}
      aria-labelledby={`preset-${presetId}-title`}
    >
      <div className="pov-card__signal-bar">
        <span className="pov-card__live">
          <span className="pov-card__live-dot" aria-hidden="true" />
          Live
        </span>
        <span className="pov-card__mode">{preset.label}</span>
      </div>
      <div id={viewportId} className="pov-card__viewport-shell">
        <CourtViewport
          className="pov-card__viewport"
          timeSource={timeSource}
          compiledMatch={compiledMatch}
          index={index}
          cameraRig={<PresetCameraRig presetId={presetId} />}
        />
      </div>
      <div className="pov-card__identity">
        <div className="pov-card__player">
          <h2 id={`preset-${presetId}-title`}>{preset.label}</h2>
          <p>Pinned broadcast angle · key {preset.shortcut}</p>
        </div>
      </div>
      <button
        className="pov-card__expand"
        type="button"
        aria-controls={viewportId}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${preset.label} camera`}
        onClick={() => setExpanded((value) => !value)}
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.35" aria-hidden="true">
          {expanded ? (
            <>
              <path d="M8 3v5H3M12 17v-5h5" />
              <path d="m3 8 5-5M17 12l-5 5" />
            </>
          ) : (
            <>
              <path d="M7 3H3v4M13 17h4v-4" />
              <path d="m3 7 4-4M17 13l-4 4" />
            </>
          )}
        </svg>
      </button>
    </article>
  );
}

export interface PlacedCameraCardProps extends SharedCardProps {
  camera: PlacedCamera;
  onHeightChange: (height: number) => void;
  onTrackChange: (trackBall: boolean) => void;
  onRemove: () => void;
}

export function PlacedCameraCard({
  camera,
  timeSource,
  compiledMatch,
  index,
  onHeightChange,
  onTrackChange,
  onRemove,
}: PlacedCameraCardProps) {
  const [expanded, setExpanded] = useState(false);
  const viewportId = `placed-${camera.id}-viewport`;

  return (
    <article
      className={`pov-card camera-card${expanded ? ' pov-card--expanded' : ''}`}
      aria-labelledby={`placed-${camera.id}-title`}
    >
      <div className="pov-card__signal-bar">
        <span className="pov-card__live">
          <span className="pov-card__live-dot" aria-hidden="true" />
          Live
        </span>
        <span className="pov-card__mode">Pinned</span>
      </div>
      <div id={viewportId} className="pov-card__viewport-shell">
        <CourtViewport
          className="pov-card__viewport"
          timeSource={timeSource}
          compiledMatch={compiledMatch}
          index={index}
          cameraRig={
            <PlacedCameraRig
              camera={camera}
              timeSource={timeSource}
              compiledMatch={compiledMatch}
            />
          }
        />
      </div>
      <div className="pov-card__identity">
        <div className="pov-card__player">
          <h2 id={`placed-${camera.id}-title`}>Drop cam</h2>
          <p>
            {camera.height.toFixed(1)} m · {camera.trackBall ? 'tracking' : 'fixed'}
          </p>
        </div>
      </div>
      <div className="camera-card__controls">
        <label>
          Height
          <input
            type="range"
            min={0.8}
            max={8}
            step={0.1}
            value={camera.height}
            aria-label="Pinned camera height"
            onChange={(event) => onHeightChange(Number(event.target.value))}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={camera.trackBall}
            onChange={(event) => onTrackChange(event.target.checked)}
          />
          Track ball
        </label>
        <button
          type="button"
          className="hawk-button hawk-button--ghost"
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
      <button
        className="pov-card__expand"
        type="button"
        aria-controls={viewportId}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} pinned camera`}
        onClick={() => setExpanded((value) => !value)}
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.35" aria-hidden="true">
          <path d="M7 3H3v4M13 17h4v-4" />
          <path d="m3 7 4-4M17 13l-4 4" />
        </svg>
      </button>
    </article>
  );
}
