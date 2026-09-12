import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type Ref,
} from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { CompiledTennisMatch } from '../data/tennis/match';
import {
  BASELINE_READY_POSITIONS,
  getBallPoseFromTimeSource,
  getPlayerPoseFromTimeSource,
  type MatchTimeSource,
} from '../lib/tennis/animation';
import type { ShotPlayerSide } from '../lib/tennis/trajectory';

interface PlayerKit {
  readonly shirt: string;
  readonly shorts: string;
  readonly accent: string;
  readonly shoes: string;
  readonly skin: string;
  readonly hair: string;
}

const ALCARAZ_KIT: PlayerKit = {
  shirt: '#8d2942',
  shorts: '#eee9df',
  accent: '#eab64d',
  shoes: '#d9f0eb',
  skin: '#b86f4c',
  hair: '#241915',
};

const SINNER_KIT: PlayerKit = {
  shirt: '#203d5a',
  shorts: '#172c43',
  accent: '#8db8d6',
  shoes: '#f0ece4',
  skin: '#d3a078',
  hair: '#a64f2b',
};

interface LegProps {
  x: number;
  kit: PlayerKit;
  legRef: Ref<THREE.Group>;
  lowerLegRef: Ref<THREE.Group>;
}

function Leg({ x, kit, legRef, lowerLegRef }: LegProps) {
  return (
    <group ref={legRef} position={[x, 0.76, 0]}>
      <mesh name="upper-leg" position={[0, -0.2, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.075, 0.4, 6]} />
        <meshStandardMaterial color={kit.skin} roughness={0.9} />
      </mesh>
      <group ref={lowerLegRef} position={[0, -0.4, 0]}>
        <mesh name="lower-leg" position={[0, -0.18, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.055, 0.36, 6]} />
          <meshStandardMaterial color={kit.skin} roughness={0.9} />
        </mesh>
        <mesh
          name="shoe"
          position={[0, -0.37, 0.055]}
          scale={[1, 0.55, 1.8]}
          castShadow
        >
          <boxGeometry args={[0.15, 0.12, 0.22]} />
          <meshStandardMaterial
            color={kit.shoes}
            roughness={0.72}
          />
        </mesh>
      </group>
    </group>
  );
}

export interface PlayerAvatarProps {
  side: ShotPlayerSide;
  timeSource: MatchTimeSource;
  compiledMatch: CompiledTennisMatch;
  /** Hides only this side's head geometry for a first-person viewport. */
  povSide?: ShotPlayerSide;
  /** Receives the named group positioned at roughly eye/head height. */
  headRef?: Ref<THREE.Group>;
}

export const PlayerAvatar = forwardRef<THREE.Group, PlayerAvatarProps>(
  function PlayerAvatar(
    { side, timeSource, compiledMatch, povSide, headRef },
    forwardedRef,
  ) {
    const player = compiledMatch.match.players[side];
    const kit = player.id === 'carlos-alcaraz' ? ALCARAZ_KIT : SINNER_KIT;
    const initialPosition = BASELINE_READY_POSITIONS[side];
    const rootRef = useRef<THREE.Group>(null);
    const torsoRef = useRef<THREE.Group>(null);
    const leftLegRef = useRef<THREE.Group>(null);
    const leftLowerLegRef = useRef<THREE.Group>(null);
    const rightLegRef = useRef<THREE.Group>(null);
    const rightLowerLegRef = useRef<THREE.Group>(null);
    const racketArmRef = useRef<THREE.Group>(null);
    const racketForearmRef = useRef<THREE.Group>(null);
    const racketRef = useRef<THREE.Group>(null);
    const supportArmRef = useRef<THREE.Group>(null);

    useImperativeHandle(forwardedRef, () => rootRef.current!, []);

    useFrame(() => {
      const root = rootRef.current;
      const torso = torsoRef.current;
      const leftLeg = leftLegRef.current;
      const leftLowerLeg = leftLowerLegRef.current;
      const rightLeg = rightLegRef.current;
      const rightLowerLeg = rightLowerLegRef.current;
      const racketArm = racketArmRef.current;
      const racketForearm = racketForearmRef.current;
      const racket = racketRef.current;
      const supportArm = supportArmRef.current;
      if (
        !root ||
        !torso ||
        !leftLeg ||
        !leftLowerLeg ||
        !rightLeg ||
        !rightLowerLeg ||
        !racketArm ||
        !racketForearm ||
        !racket ||
        !supportArm
      ) {
        return;
      }

      const pose = getPlayerPoseFromTimeSource(
        side,
        timeSource,
        compiledMatch,
      );
      const ball = getBallPoseFromTimeSource(timeSource, compiledMatch);
      const x = pose.position[0];
      const y = pose.position[1];
      const z = pose.position[2];
      const ballDistance = Math.hypot(
        ball.position[0] - x,
        ball.position[2] - z,
      );
      const targetX =
        ball.visible && ballDistance > 0.25 ? ball.position[0] : 0;
      const targetZ =
        ball.visible && ballDistance > 0.25 ? ball.position[2] : 0;
      const facingYaw = Math.atan2(targetX - x, targetZ - z);

      const progress = pose.swingProgress;
      const stroke = (1 - Math.cos(progress * Math.PI * 2)) / 2;
      const travel = Math.sin(progress * Math.PI * 2);
      const isBackhand = pose.swingShot?.type === 'backhand';
      const isServe = pose.swingShot?.type === 'serve';
      const strokeSide = isBackhand ? -1 : 1;
      const racketArmPitch = isServe
        ? -0.25 - stroke * 1.45
        : -0.12 - stroke * 0.95;
      const racketArmYaw =
        strokeSide * (0.35 - stroke * 0.62) + travel * 0.2;
      const racketArmRoll = strokeSide * (0.18 + travel * 0.5);
      const supportArmPitch = isBackhand
        ? -0.1 - stroke * 0.62
        : -0.08 + stroke * 0.2;
      const stride = travel * 0.08;

      root.position.set(x, y, z);
      root.rotation.set(0, facingYaw, 0);
      torso.rotation.set(
        stroke * -0.08,
        0,
        strokeSide * stroke * 0.06,
      );
      leftLeg.rotation.set(stride, 0, 0);
      leftLowerLeg.rotation.set(-stride * 0.7, 0, 0);
      rightLeg.rotation.set(-stride, 0, 0);
      rightLowerLeg.rotation.set(stride * 0.7, 0, 0);
      racketArm.rotation.set(
        racketArmPitch,
        racketArmYaw,
        racketArmRoll,
      );
      racketForearm.rotation.set(
        -0.16 - stroke * 0.35,
        0,
        strokeSide * 0.08,
      );
      racket.rotation.set(0.06, 0, strokeSide * 0.16);
      supportArm.rotation.set(
        supportArmPitch,
        isBackhand ? 0.28 * stroke : -0.2,
        isBackhand ? -0.38 * stroke : -0.12,
      );
    });

    return (
      <group
        ref={rootRef}
        name={`player-${player.id}`}
        position={[
          initialPosition[0],
          initialPosition[1],
          initialPosition[2],
        ]}
        rotation={[0, side === 'near' ? 0 : Math.PI, 0]}
      >
        <Leg
          x={-0.14}
          kit={kit}
          legRef={leftLegRef}
          lowerLegRef={leftLowerLegRef}
        />
        <Leg
          x={0.14}
          kit={kit}
          legRef={rightLegRef}
          lowerLegRef={rightLowerLegRef}
        />

        <mesh name="shorts" position={[0, 0.82, 0]} castShadow>
          <boxGeometry args={[0.45, 0.25, 0.27]} />
          <meshStandardMaterial color={kit.shorts} roughness={0.82} />
        </mesh>

        <group
          ref={torsoRef}
          name="torso"
          position={[0, 1.18, 0]}
        >
          <mesh castShadow>
            <boxGeometry args={[0.48, 0.7, 0.28]} />
            <meshStandardMaterial color={kit.shirt} roughness={0.78} />
          </mesh>
          <mesh position={[0, 0.14, 0.146]}>
            <boxGeometry args={[0.25, 0.06, 0.012]} />
            <meshStandardMaterial
              color={kit.accent}
              emissive={kit.accent}
              emissiveIntensity={0.05}
            />
          </mesh>
        </group>

        <mesh name="neck" position={[0, 1.56, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.075, 0.13, 8]} />
          <meshStandardMaterial color={kit.skin} roughness={0.92} />
        </mesh>

        <group
          ref={headRef}
          name="head-anchor"
          position={[0, 1.7, 0]}
          visible={povSide !== side}
        >
          <mesh name="head" castShadow>
            <sphereGeometry args={[0.14, 8, 6]} />
            <meshStandardMaterial color={kit.skin} roughness={0.9} />
          </mesh>
          <mesh
            name="hair"
            position={[0, 0.075, -0.008]}
            scale={[1.03, 0.56, 1.03]}
            castShadow
          >
            <sphereGeometry args={[0.142, 8, 5]} />
            <meshStandardMaterial color={kit.hair} roughness={1} />
          </mesh>
        </group>

        <group
          ref={racketArmRef}
          name="racket-arm"
          position={[0.29, 1.43, 0]}
          rotation={[-0.12, 0.35, 0.18]}
        >
          <mesh name="upper-arm" position={[0, -0.18, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.06, 0.36, 6]} />
            <meshStandardMaterial color={kit.skin} roughness={0.9} />
          </mesh>
          <mesh name="elbow" position={[0, -0.37, 0]} castShadow>
            <sphereGeometry args={[0.065, 7, 5]} />
            <meshStandardMaterial color={kit.skin} roughness={0.9} />
          </mesh>
          <group
            ref={racketForearmRef}
            name="forearm"
            position={[0, -0.37, 0]}
            rotation={[-0.16, 0, 0.08]}
          >
            <mesh position={[0, -0.17, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.045, 0.34, 6]} />
              <meshStandardMaterial color={kit.skin} roughness={0.9} />
            </mesh>
            <mesh name="wristband" position={[0, -0.32, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.06, 0.08, 8]} />
              <meshStandardMaterial color={kit.accent} roughness={0.75} />
            </mesh>

            <group
              ref={racketRef}
              name="racket"
              position={[0, -0.38, 0]}
              rotation={[0.06, 0, 0.16]}
            >
              <mesh name="racket-handle" position={[0, -0.11, 0]} castShadow>
                <cylinderGeometry args={[0.022, 0.025, 0.24, 8]} />
                <meshStandardMaterial
                  color="#251f1a"
                  roughness={0.62}
                />
              </mesh>
              <mesh name="racket-frame" position={[0, -0.37, 0]} castShadow>
                <torusGeometry args={[0.17, 0.018, 6, 14]} />
                <meshStandardMaterial
                  color={kit.accent}
                  metalness={0.25}
                  roughness={0.48}
                />
              </mesh>
              <mesh name="racket-strings-x" position={[0, -0.37, 0]}>
                <boxGeometry args={[0.28, 0.008, 0.006]} />
                <meshBasicMaterial color="#d8d4ca" />
              </mesh>
              <mesh name="racket-strings-y" position={[0, -0.37, 0]}>
                <boxGeometry args={[0.008, 0.28, 0.006]} />
                <meshBasicMaterial color="#d8d4ca" />
              </mesh>
            </group>
          </group>
        </group>

        <group
          ref={supportArmRef}
          name="support-arm"
          position={[-0.29, 1.43, 0]}
          rotation={[-0.08, -0.2, -0.12]}
        >
          <mesh name="upper-arm" position={[0, -0.18, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.06, 0.36, 6]} />
            <meshStandardMaterial color={kit.skin} roughness={0.9} />
          </mesh>
          <group position={[0, -0.36, 0]} rotation={[-0.28, 0, 0]}>
            <mesh name="forearm" position={[0, -0.16, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.045, 0.32, 6]} />
              <meshStandardMaterial color={kit.skin} roughness={0.9} />
            </mesh>
          </group>
        </group>
      </group>
    );
  },
);
