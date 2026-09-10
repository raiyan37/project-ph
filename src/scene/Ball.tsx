import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { CompiledTennisMatch } from '../data/tennis/match';
import {
  getBallPoseFromTimeSource,
  type MatchTimeSource,
} from '../lib/tennis/animation';
import { BALL_RADIUS } from '../lib/tennis/court';

const OPTIC_YELLOW = '#dfff32';
const SHADOW_Y = 0.008;

export interface BallProps {
  timeSource: MatchTimeSource;
  compiledMatch: CompiledTennisMatch;
}

export function Ball({ timeSource, compiledMatch }: BallProps) {
  const rootRef = useRef<THREE.Group>(null);
  const ballRef = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const root = rootRef.current;
    const ball = ballRef.current;
    const shadow = shadowRef.current;
    if (!root || !ball || !shadow) {
      return;
    }

    const pose = getBallPoseFromTimeSource(timeSource, compiledMatch);
    root.visible = pose.visible;
    if (!pose.visible) {
      return;
    }

    const x = pose.position[0];
    const y = pose.position[1];
    const z = pose.position[2];
    const shadowScale = Math.max(0.55, Math.min(1.1, 1.05 - y * 0.08));

    ball.position.set(x, y, z);
    shadow.position.set(x, SHADOW_Y, z);
    shadow.scale.setScalar(shadowScale);
  });

  return (
    <group ref={rootRef} name="animated-ball" visible={false}>
      <group ref={ballRef}>
        <mesh name="tennis-ball" castShadow>
          <sphereGeometry args={[BALL_RADIUS, 20, 12]} />
          <meshStandardMaterial
            color={OPTIC_YELLOW}
            emissive={OPTIC_YELLOW}
            emissiveIntensity={0.18}
            roughness={0.7}
          />
        </mesh>

        <mesh name="ball-legibility-glow" scale={1.75}>
          <sphereGeometry args={[BALL_RADIUS, 16, 10]} />
          <meshBasicMaterial
            color={OPTIC_YELLOW}
            transparent
            opacity={0.1}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        <pointLight
          color={OPTIC_YELLOW}
          intensity={0.18}
          distance={0.65}
          decay={2}
        />
      </group>

      <mesh
        ref={shadowRef}
        name="ball-ground-shadow"
        position={[0, SHADOW_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={2}
      >
        <circleGeometry args={[0.13, 20]} />
        <meshBasicMaterial
          color="#020504"
          transparent
          opacity={0.28}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
