import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CompiledPoint, CompiledTennisMatch } from '../../data/tennis/match';
import {
  replayCameraForOutcome,
  replayMeasurement,
  replayTrail,
  type ReplayCamera,
} from '../../lib/tennis/replay';
import { CourtViewport } from '../../scene/SceneRoot';
import './tennis-shell.css';

const SPEEDS = [0.25, 0.5, 1] as const;

function ReplayOrbitCamera({
  camera,
  orbitRef,
}: {
  camera: ReplayCamera;
  orbitRef: MutableRefObject<{ yaw: number; pitch: number }>;
}) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(...camera.target), [camera]);

  useFrame(() => {
    const rig = cameraRef.current;
    if (!rig) {
      return;
    }
    offset.set(
      camera.position[0] - camera.target[0],
      camera.position[1] - camera.target[1],
      camera.position[2] - camera.target[2],
    );
    const radius = offset.length();
    const phi = THREE.MathUtils.clamp(
      Math.acos(offset.y / Math.max(radius, 1e-6)) + orbitRef.current.pitch,
      0.12,
      Math.PI - 0.12,
    );
    const theta = Math.atan2(offset.x, offset.z) + orbitRef.current.yaw;
    offset.setFromSphericalCoords(radius, phi, theta);
    rig.position.set(
      camera.target[0] + offset.x,
      camera.target[1] + offset.y,
      camera.target[2] + offset.z,
    );
    rig.lookAt(target);
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      position={camera.position}
      fov={camera.fov}
      near={0.08}
      far={140}
    />
  );
}

export interface ReplayOverlayProps {
  compiledPoint: CompiledPoint;
  compiledMatch: CompiledTennisMatch;
  onDismiss: () => void;
}

export function ReplayOverlay({
  compiledPoint,
  compiledMatch,
  onDismiss,
}: ReplayOverlayProps) {
  const startT = compiledPoint.point.startT;
  const endT = compiledPoint.point.endT;
  const [camera, setCamera] = useState(() =>
    replayCameraForOutcome(compiledPoint.point.outcome),
  );
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(0.5);
  const [playing, setPlaying] = useState(true);
  const [displayTime, setDisplayTime] = useState(startT);
  const timeHolder = useRef(startT);
  const orbitRef = useRef({ yaw: 0, pitch: 0 });
  const draggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const measurement = useMemo(
    () => replayMeasurement(compiledPoint),
    [compiledPoint],
  );

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let hudAt = 0;
    const tick = (now: number) => {
      const delta = ((now - last) / 1000) * speed;
      last = now;
      if (playing) {
        timeHolder.current = Math.min(
          endT,
          timeHolder.current + delta,
        );
      }
      if (now - hudAt > 80) {
        hudAt = now;
        setDisplayTime(timeHolder.current);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [endT, playing, speed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
      }
      if (event.key === ' ') {
        event.preventDefault();
        setPlaying((value) => !value);
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        timeHolder.current = Math.max(
          startT,
          timeHolder.current - 0.2,
        );
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        timeHolder.current = Math.min(
          endT,
          timeHolder.current + 0.2,
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [endT, onDismiss, startT]);

  const overlay = useMemo(() => {
    const trail = replayTrail(compiledPoint, displayTime);
    const bounce = compiledPoint.trajectories[compiledPoint.point.decisiveShotIndex]
      ?.bounces[0];
    return {
      trail,
      bounceMark:
        bounce && displayTime >= bounce.t ? bounce.position : undefined,
      bounceInBounds: bounce?.inBounds,
      netLeader:
        measurement.kind === 'net-clearance'
          ? {
              x: measurement.from[0],
              fromY: measurement.from[1],
              toY: measurement.to[1],
            }
          : undefined,
      lineLeader:
        measurement.kind === 'in-out' && bounce && displayTime >= bounce.t
          ? { from: measurement.from, to: measurement.to }
          : undefined,
    };
  }, [compiledPoint, displayTime, measurement]);

  const progress = endT > startT ? (displayTime - startT) / (endT - startT) : 0;
  const lineCall = compiledPoint.point.outcome === 'out';

  return (
    <div
      className="tennis-fullscreen tennis-fullscreen--replay"
      role="dialog"
      aria-label={`Hawk-Eye replay. ${compiledPoint.point.replayLabel}. ${measurement.display}.`}
    >
      <div
        className="tennis-fullscreen__view"
        style={{ cursor: 'grab' }}
        onPointerDown={(event) => {
          draggingRef.current = true;
          lastPointerRef.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!draggingRef.current) {
            return;
          }
          orbitRef.current.yaw +=
            (event.clientX - lastPointerRef.current.x) * 0.005;
          orbitRef.current.pitch +=
            (event.clientY - lastPointerRef.current.y) * 0.004;
          lastPointerRef.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={() => {
          draggingRef.current = false;
        }}
      >
        <CourtViewport
          className="tennis-fullscreen__view"
          timeSource={timeHolder}
          compiledMatch={compiledMatch}
          index={60}
          overlay={overlay}
          cameraRig={<ReplayOrbitCamera camera={camera} orbitRef={orbitRef} />}
        />
      </div>
      <div className="tennis-hud">
        <div className="replay-hud__panel">
          <p className="replay-hud__label">{compiledPoint.point.replayLabel}</p>
          <p className="replay-hud__callout">{measurement.display}</p>
          <label className="replay-hud__label">
            Scrub
            <input
              className="replay-hud__scrub"
              type="range"
              min={startT}
              max={endT}
              step={0.01}
              value={displayTime}
              aria-label="Replay scrub"
              onChange={(event) => {
                const next = Number(event.target.value);
                timeHolder.current = next;
                setDisplayTime(next);
              }}
            />
          </label>
          <div className="replay-hud__speeds">
            {SPEEDS.map((value) => (
              <button
                key={value}
                type="button"
                className={`hawk-button${speed === value ? ' is-active' : ''}`}
                aria-pressed={speed === value}
                onClick={() => setSpeed(value)}
              >
                {value}x
              </button>
            ))}
            <button
              type="button"
              className="hawk-button"
              onClick={() => setPlaying((value) => !value)}
            >
              {playing ? 'Pause' : 'Play'}
            </button>
          </div>
          {lineCall ? (
            <div className="replay-hud__angles">
              <button
                type="button"
                className={`hawk-button${camera.id === 'overhead' ? ' is-active' : ''}`}
                onClick={() => setCamera(replayCameraForOutcome('out'))}
              >
                Overhead
              </button>
              <button
                type="button"
                className={`hawk-button${camera.id === 'down-the-line' ? ' is-active' : ''}`}
                onClick={() => setCamera(replayCameraForOutcome('winner'))}
              >
                Down the line
              </button>
            </div>
          ) : null}
          <button type="button" className="hawk-button" onClick={onDismiss}>
            Resume broadcast
          </button>
          <p className="replay-hud__label">
            Drag to orbit · arrows scrub · space pause · {Math.round(progress * 100)}%
          </p>
        </div>
      </div>
    </div>
  );
}
