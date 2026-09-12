import { useEffect, useMemo, useRef, useState } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CompiledTennisMatch } from '../../data/tennis/match';
import {
  getBallPoseAtTime,
  getPlayerPoseAtTime,
  type MatchTimeSource,
} from '../../lib/tennis/animation';
import type { Vec3 } from '../../lib/tennis/court';
import type { ShotPlayerSide } from '../../lib/tennis/trajectory';

const HEAD_ANCHOR_HEIGHT = 1.7;
const EYE_FORWARD_OFFSET = 0.1;
const FALLBACK_TARGET_HEIGHT = 1.15;
const FALLBACK_TARGET_DEPTH = 4.5;
const POSITION_DAMPING = 13;
const ROTATION_DAMPING = 16;
const MAX_FRAME_DELTA = 0.1;

export interface PlayerPOVCameraPose {
  readonly position: Vec3;
  readonly target: Vec3;
}

/**
 * Returns a deterministic first-person camera pose in court-space metres.
 * The small forward eye offset places the near plane beyond the head anchor
 * while keeping the player's body and racket in view.
 */
// The task intentionally colocates the pure pose API with its camera component.
// eslint-disable-next-line react-refresh/only-export-components
export function getPlayerPOVCameraPose(
  side: ShotPlayerSide,
  mediaTime: number,
  compiled: CompiledTennisMatch,
): PlayerPOVCameraPose {
  const player = getPlayerPoseAtTime(side, mediaTime, compiled);
  const ball = getBallPoseAtTime(mediaTime, compiled);
  const courtDirection = side === 'near' ? 1 : -1;
  const position: Vec3 = [
    player.position[0],
    player.position[1] + HEAD_ANCHOR_HEIGHT,
    player.position[2] + courtDirection * EYE_FORWARD_OFFSET,
  ];
  const target: Vec3 = ball.visible
    ? ball.position
    : [
        0,
        FALLBACK_TARGET_HEIGHT,
        courtDirection * FALLBACK_TARGET_DEPTH,
      ];

  return { position, target };
}

export interface PlayerPOVCameraProps {
  side: ShotPlayerSide;
  timeSource: MatchTimeSource;
  compiledMatch: CompiledTennisMatch;
}

export function PlayerPOVCamera({
  side,
  timeSource,
  compiledMatch,
}: PlayerPOVCameraProps) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const initializedRef = useRef(false);
  const [initialPose] = useState(
    () => getPlayerPOVCameraPose(side, timeSource.current, compiledMatch),
  );
  const frameMath = useMemo(
    () => ({
      desiredPosition: new THREE.Vector3(),
      desiredTarget: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      lookMatrix: new THREE.Matrix4(),
      desiredQuaternion: new THREE.Quaternion(),
    }),
    [],
  );

  useEffect(() => {
    initializedRef.current = false;
  }, [compiledMatch, side, timeSource]);

  useFrame((_, delta) => {
    const camera = cameraRef.current;
    if (!camera) {
      return;
    }

    const pose = getPlayerPOVCameraPose(
      side,
      timeSource.current,
      compiledMatch,
    );
    frameMath.desiredPosition.set(...pose.position);
    frameMath.desiredTarget.set(...pose.target);
    frameMath.lookMatrix.lookAt(
      frameMath.desiredPosition,
      frameMath.desiredTarget,
      frameMath.up,
    );
    frameMath.desiredQuaternion.setFromRotationMatrix(frameMath.lookMatrix);

    if (!initializedRef.current) {
      camera.position.copy(frameMath.desiredPosition);
      camera.quaternion.copy(frameMath.desiredQuaternion);
      initializedRef.current = true;
      return;
    }

    const frameDelta = Math.min(Math.max(delta, 0), MAX_FRAME_DELTA);
    camera.position.lerp(
      frameMath.desiredPosition,
      1 - Math.exp(-POSITION_DAMPING * frameDelta),
    );
    camera.quaternion.slerp(
      frameMath.desiredQuaternion,
      1 - Math.exp(-ROTATION_DAMPING * frameDelta),
    );
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      position={initialPose.position}
      fov={58}
      near={0.025}
      far={100}
    />
  );
}
