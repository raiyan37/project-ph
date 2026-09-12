import { useRef } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getPovSampleTime } from '../../lib/tennis/streamMedia';
import type { MatchTimeSource } from '../../lib/tennis/animation';
import type { ShotPlayerSide } from '../../lib/tennis/trajectory';
import { interpolatePovTrack } from './tracks';
import type { PovManifest } from './types';

const FALLBACK_POSITION = [0, 1.7, 0.8] as const;
const FALLBACK_TARGET = [0, 1.2, -8] as const;

export interface PlayerCloudCameraProps {
  side: ShotPlayerSide;
  timeSource: MatchTimeSource;
  manifest: PovManifest;
}

export function PlayerCloudCamera({
  side,
  timeSource,
  manifest,
}: PlayerCloudCameraProps) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  useFrame(() => {
    const camera = cameraRef.current;
    if (!camera) {
      return;
    }
    const pose = interpolatePovTrack(
      manifest.tracks,
      getPovSampleTime(timeSource.current),
      side,
    );

    if (pose.standby) {
      camera.position.set(...FALLBACK_POSITION);
      camera.lookAt(...FALLBACK_TARGET);
      return;
    }

    camera.position.set(...pose.position);
    camera.lookAt(pose.lookAt[0], pose.lookAt[1], pose.lookAt[2]);
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      position={[...FALLBACK_POSITION]}
      fov={58}
      near={0.05}
      far={80}
    />
  );
}
