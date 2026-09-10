import { useMemo, useRef } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CompiledTennisMatch } from '../../data/tennis/match';
import {
  getBallPoseFromTimeSource,
  type MatchTimeSource,
} from '../../lib/tennis/animation';
import {
  placedCameraPose,
  type PlacedCamera,
} from './placement';

export interface PlacedCameraRigProps {
  camera: PlacedCamera;
  timeSource: MatchTimeSource;
  compiledMatch: CompiledTennisMatch;
}

export function PlacedCameraRig({
  camera,
  timeSource,
  compiledMatch,
}: PlacedCameraRigProps) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const initial = placedCameraPose(camera);

  useFrame(() => {
    const rig = cameraRef.current;
    if (!rig) {
      return;
    }
    const ball = getBallPoseFromTimeSource(timeSource, compiledMatch);
    const pose = placedCameraPose(
      camera,
      ball.visible ? ball.position : undefined,
    );
    rig.position.set(pose.position[0], pose.position[1], pose.position[2]);
    lookTarget.set(pose.target[0], pose.target[1], pose.target[2]);
    rig.lookAt(lookTarget);
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      position={initial.position}
      fov={52}
      near={0.08}
      far={120}
    />
  );
}
