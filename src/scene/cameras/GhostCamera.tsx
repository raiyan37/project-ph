import { useMemo, useRef, type MutableRefObject } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  DEFAULT_GHOST_POSE,
  applyGhostLook,
  ghostLookTarget,
  integrateGhost,
  type GhostMoveInput,
  type GhostPose,
} from './ghost';

export interface GhostKeyState {
  forward: number;
  right: number;
  up: number;
  sprint: boolean;
  lookX: number;
  lookY: number;
}

export interface GhostCameraProps {
  poseRef: MutableRefObject<GhostPose>;
  inputRef: MutableRefObject<GhostKeyState>;
}

export function GhostCamera({ poseRef, inputRef }: GhostCameraProps) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const camera = cameraRef.current;
    if (!camera) {
      return;
    }
    const frameDelta = Math.min(Math.max(delta, 0), 0.08);
    const input = inputRef.current;
    const move: GhostMoveInput = {
      forward: input.forward,
      right: input.right,
      up: input.up,
      sprint: input.sprint,
    };
    poseRef.current = integrateGhost(poseRef.current, move, frameDelta);
    if (input.lookX !== 0 || input.lookY !== 0) {
      poseRef.current = applyGhostLook(
        poseRef.current,
        input.lookX * frameDelta * 1.35,
        input.lookY * frameDelta * 1.15,
      );
    }
    const pose = poseRef.current;
    const target = ghostLookTarget(pose);
    camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
    lookTarget.set(target[0], target[1], target[2]);
    camera.lookAt(lookTarget);
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      position={DEFAULT_GHOST_POSE.position}
      fov={62}
      near={0.08}
      far={140}
    />
  );
}
