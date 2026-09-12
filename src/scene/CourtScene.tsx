import { useMemo, type ReactNode } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { CompiledTennisMatch } from '../data/tennis/match';
import type { MatchTimeSource } from '../lib/tennis/animation';
import type { Vec3 } from '../lib/tennis/court';
import { Ball } from './Ball';
import { Court } from './Court';
import { Net } from './Net';
import { PlayerAvatar } from './PlayerAvatar';
import type { ShotPlayerSide } from '../lib/tennis/trajectory';

const SURROUND_COLOR = '#101821';
const STAND_COLOR = '#17222d';
const TRAIL_COLOR = '#dfff32';
const IN_MARK = '#dfff32';
const OUT_MARK = '#ff4d3a';

export interface CourtOverlay {
  readonly trail?: readonly Vec3[];
  readonly bounceMark?: Vec3;
  readonly bounceInBounds?: boolean;
  readonly netLeader?: { readonly x: number; readonly fromY: number; readonly toY: number };
  readonly lineLeader?: { readonly from: Vec3; readonly to: Vec3 };
}

function StadiumEnvironment() {
  return (
    <group name="restrained-stadium">
      <mesh
        name="stadium-floor"
        position={[0, -0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[72, 72]} />
        <meshStandardMaterial color={SURROUND_COLOR} roughness={0.98} />
      </mesh>

      <mesh
        name="stand-near"
        position={[0, 2.1, -21]}
        rotation={[0.08, 0, 0]}
        receiveShadow
      >
        <boxGeometry args={[34, 4.2, 6]} />
        <meshStandardMaterial color={STAND_COLOR} roughness={0.94} />
      </mesh>
      <mesh
        name="stand-far"
        position={[0, 2.1, 21]}
        rotation={[-0.08, 0, 0]}
        receiveShadow
      >
        <boxGeometry args={[34, 4.2, 6]} />
        <meshStandardMaterial color={STAND_COLOR} roughness={0.94} />
      </mesh>
      <mesh
        name="stand-left"
        position={[-15, 1.7, 0]}
        rotation={[0, 0, -0.08]}
        receiveShadow
      >
        <boxGeometry args={[7, 3.4, 36]} />
        <meshStandardMaterial color={STAND_COLOR} roughness={0.94} />
      </mesh>
      <mesh
        name="stand-right"
        position={[15, 1.7, 0]}
        rotation={[0, 0, 0.08]}
        receiveShadow
      >
        <boxGeometry args={[7, 3.4, 36]} />
        <meshStandardMaterial color={STAND_COLOR} roughness={0.94} />
      </mesh>

      <mesh name="far-light-band" position={[0, 4.35, 17.95]}>
        <boxGeometry args={[20, 0.08, 0.05]} />
        <meshBasicMaterial color="#dce7df" toneMapped={false} />
      </mesh>
    </group>
  );
}

function ReplayGraphics({ overlay }: { overlay: CourtOverlay }) {
  const trailPoints = useMemo(
    () => overlay.trail?.map((point) => new THREE.Vector3(...point)) ?? [],
    [overlay.trail],
  );
  const markColor = overlay.bounceInBounds === false ? OUT_MARK : IN_MARK;

  return (
    <group name="hawk-eye-overlay">
      {trailPoints.length > 1 ? (
        <Line
          points={trailPoints}
          color={TRAIL_COLOR}
          lineWidth={2.4}
          transparent
          opacity={0.92}
        />
      ) : null}

      {overlay.bounceMark ? (
        <mesh
          name="bounce-mark"
          position={[overlay.bounceMark[0], 0.012, overlay.bounceMark[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.07, 0.16, 24]} />
          <meshBasicMaterial color={markColor} toneMapped={false} />
        </mesh>
      ) : null}

      {overlay.netLeader ? (
        <mesh
          name="net-clearance-leader"
          position={[
            overlay.netLeader.x,
            (overlay.netLeader.fromY + overlay.netLeader.toY) / 2,
            0,
          ]}
        >
          <boxGeometry
            args={[
              0.012,
              Math.max(0.02, Math.abs(overlay.netLeader.toY - overlay.netLeader.fromY)),
              0.012,
            ]}
          />
          <meshBasicMaterial color={TRAIL_COLOR} toneMapped={false} />
        </mesh>
      ) : null}

      {overlay.lineLeader ? (
        <Line
          points={[
            new THREE.Vector3(...overlay.lineLeader.from),
            new THREE.Vector3(...overlay.lineLeader.to),
          ]}
          color={markColor}
          lineWidth={1.6}
        />
      ) : null}
    </group>
  );
}

export interface CourtSceneProps {
  timeSource: MatchTimeSource;
  compiledMatch: CompiledTennisMatch;
  povSide?: ShotPlayerSide;
  overlay?: CourtOverlay;
  children?: ReactNode;
}

export function CourtScene({
  timeSource,
  compiledMatch,
  povSide,
  overlay,
  children,
}: CourtSceneProps) {
  return (
    <>
      <color attach="background" args={[SURROUND_COLOR]} />
      <fog attach="fog" args={[SURROUND_COLOR, 34, 68]} />

      <ambientLight color="#d8e3dc" intensity={0.55} />
      <hemisphereLight
        color="#dce8e1"
        groundColor="#07110e"
        intensity={1.1}
      />
      <directionalLight
        name="stadium-key-light"
        color="#fff7e7"
        position={[-8, 15, -7]}
        intensity={2.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={45}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-bias={-0.00012}
      />
      <directionalLight
        name="stadium-fill-light"
        color="#b8d4e5"
        position={[10, 9, 12]}
        intensity={0.75}
      />

      <StadiumEnvironment />
      <Court />
      <Net />
      <Ball timeSource={timeSource} compiledMatch={compiledMatch} />
      <PlayerAvatar
        side="near"
        timeSource={timeSource}
        compiledMatch={compiledMatch}
        povSide={povSide}
      />
      <PlayerAvatar
        side="far"
        timeSource={timeSource}
        compiledMatch={compiledMatch}
        povSide={povSide}
      />
      {overlay ? <ReplayGraphics overlay={overlay} /> : null}
      {children}
    </>
  );
}
