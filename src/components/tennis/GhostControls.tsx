import { useEffect, useRef, type MutableRefObject } from 'react';
import type { CompiledTennisMatch } from '../../data/tennis/match';
import type { MatchTimeSource } from '../../lib/tennis/animation';
import {
  applyGhostLook,
  DEFAULT_GHOST_POSE,
  type GhostPose,
} from '../../scene/cameras/ghost';
import {
  GhostCamera,
  type GhostKeyState,
} from '../../scene/cameras/GhostCamera';
import { CourtViewport } from '../../scene/SceneRoot';
import './tennis-shell.css';

const EMPTY_INPUT: GhostKeyState = {
  forward: 0,
  right: 0,
  up: 0,
  sprint: false,
  lookX: 0,
  lookY: 0,
};

function readKeyState(keys: Set<string>): GhostKeyState {
  return {
    forward: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
    right: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
    up: (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0),
    sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    lookX: (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0),
    lookY: (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0),
  };
}

export interface GhostControlsProps {
  timeSource: MatchTimeSource;
  compiledMatch: CompiledTennisMatch;
  frozen: boolean;
  onFrozenChange: (frozen: boolean) => void;
  onExit: () => void;
}

export function GhostControls({
  timeSource,
  compiledMatch,
  frozen,
  onFrozenChange,
  onExit,
}: GhostControlsProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const poseRef = useRef<GhostPose>(DEFAULT_GHOST_POSE);
  const inputRef = useRef<GhostKeyState>(EMPTY_INPUT);
  const keysRef = useRef(new Set<string>());
  const frozenRef = useRef(frozen);

  useEffect(() => {
    frozenRef.current = frozen;
  }, [frozen]);

  useEffect(() => {
    const syncInput = () => {
      inputRef.current = readKeyState(keysRef.current);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        onExit();
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        onFrozenChange(!frozenRef.current);
        return;
      }
      keysRef.current.add(event.code);
      syncInput();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(event.code);
      syncInput();
    };
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== shellRef.current) {
        return;
      }
      poseRef.current = applyGhostLook(
        poseRef.current,
        event.movementX * 0.0022,
        -event.movementY * 0.0022,
      );
    };
    const onPointerDown = () => {
      const lock = shellRef.current?.requestPointerLock();
      if (lock && typeof lock.catch === 'function') {
        void lock.catch(() => undefined);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    const shell = shellRef.current;
    shell?.addEventListener('pointerdown', onPointerDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      shell?.removeEventListener('pointerdown', onPointerDown);
      if (document.pointerLockElement === shell) {
        document.exitPointerLock();
      }
    };
  }, [onExit, onFrozenChange]);

  return (
    <div
      ref={shellRef}
      className="tennis-fullscreen tennis-fullscreen--ghost"
      role="dialog"
      aria-label="Ghost explore mode. WASD to move, Q and E for height, arrows to look, Shift to sprint, Space to freeze, Escape to exit."
    >
      <CourtViewport
        className="tennis-fullscreen__view"
        timeSource={timeSource}
        compiledMatch={compiledMatch}
        index={50}
        interactive
        cameraRig={<GhostCamera poseRef={poseRef} inputRef={inputRef} />}
      />
      <div className="tennis-hud">
        <div className="ghost-hud__crosshair" aria-hidden="true" />
        <div className="ghost-hud__legend">
          <div>WASD move · Q/E height · arrows look</div>
          <div>Shift sprint · Space freeze · Esc exit</div>
        </div>
        {frozen ? <div className="ghost-hud__freeze">Frozen</div> : null}
        <div className="placement-hud__tools ghost-hud__actions">
          <button
            type="button"
            className={`hawk-button${frozen ? ' is-active' : ''}`}
            onClick={() => onFrozenChange(!frozen)}
          >
            {frozen ? 'Unfreeze' : 'Freeze'}
          </button>
          <button type="button" className="hawk-button" onClick={onExit}>
            Exit ghost
          </button>
        </div>
      </div>
    </div>
  );
}

export type GhostPoseRef = MutableRefObject<GhostPose>;
