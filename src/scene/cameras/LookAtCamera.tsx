import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Vec3 } from '../../lib/tennis/court';

export interface LookAtCameraProps {
  position: Vec3;
  target: Vec3;
  fov?: number;
  near?: number;
  far?: number;
  makeDefault?: boolean;
  children?: ReactNode;
}

export function LookAtCamera({
  position,
  target,
  fov = 50,
  near = 0.08,
  far = 120,
  makeDefault = true,
  children,
}: LookAtCameraProps) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const lookTarget = useMemo(() => new THREE.Vector3(...target), [target]);

  useLayoutEffect(() => {
    lookTarget.set(target[0], target[1], target[2]);
  }, [lookTarget, target]);

  useFrame(() => {
    const camera = cameraRef.current;
    if (!camera) {
      return;
    }
    camera.position.set(position[0], position[1], position[2]);
    camera.lookAt(lookTarget);
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault={makeDefault}
      position={[position[0], position[1], position[2]]}
      fov={fov}
      near={near}
      far={far}
    >
      {children}
    </PerspectiveCamera>
  );
}
