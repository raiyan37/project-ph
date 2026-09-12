import { useEffect } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { CompiledTennisMatch } from '../../data/tennis/match';
import type { MatchTimeSource } from '../../lib/tennis/animation';
import { getPresetCamera } from '../../scene/cameras/presets';
import { CourtViewport } from '../../scene/SceneRoot';
import './tennis-shell.css';

function GroundClickPlane({
  onPlace,
}: {
  onPlace: (x: number, z: number) => void;
}) {
  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onPlace(event.point.x, event.point.z);
  };

  return (
    <mesh
      name="placement-ground"
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.01, 0]}
      onPointerDown={handlePointerDown}
    >
      <planeGeometry args={[80, 80]} />
      <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
    </mesh>
  );
}

export interface PlacementModeProps {
  timeSource: MatchTimeSource;
  compiledMatch: CompiledTennisMatch;
  height: number;
  trackBall: boolean;
  onHeightChange: (height: number) => void;
  onTrackChange: (trackBall: boolean) => void;
  onPlace: (x: number, z: number) => void;
  onClose: () => void;
}

export function PlacementMode({
  timeSource,
  compiledMatch,
  height,
  trackBall,
  onHeightChange,
  onTrackChange,
  onPlace,
  onClose,
}: PlacementModeProps) {
  const overhead = getPresetCamera('overhead');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="tennis-fullscreen" role="dialog" aria-label="Place a camera">
      <CourtViewport
        className="tennis-fullscreen__view"
        timeSource={timeSource}
        compiledMatch={compiledMatch}
        index={40}
        interactive
        cameraPosition={overhead.position}
        cameraTarget={overhead.target}
      >
        <GroundClickPlane onPlace={onPlace} />
      </CourtViewport>
      <div className="tennis-hud">
        <p className="placement-hud__copy">
          Click the court to pin a camera · Esc to finish
        </p>
        <div className="placement-hud__tools">
          <label className="replay-hud__label">
            Height {height.toFixed(1)} m
            <input
              type="range"
              min={0.8}
              max={8}
              step={0.1}
              value={height}
              aria-label="New camera height"
              onChange={(event) => onHeightChange(Number(event.target.value))}
            />
          </label>
          <label className="replay-hud__label">
            <input
              type="checkbox"
              checked={trackBall}
              onChange={(event) => onTrackChange(event.target.checked)}
            />
            Track ball
          </label>
          <button type="button" className="hawk-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
