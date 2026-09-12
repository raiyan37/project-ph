import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getPovSampleTime } from '../../lib/tennis/streamMedia';
import type { MatchTimeSource } from '../../lib/tennis/animation';
import type { ShotPlayerSide } from '../../lib/tennis/trajectory';
import { interpolatePovTrack } from './tracks';
import type { PovManifest } from './types';

const VERTEX_SHADER = /* glsl */ `
  uniform sampler2D depthMap;
  uniform vec2 resolution;
  uniform vec4 K;
  uniform float depthScale;
  uniform vec3 hideCenter;
  uniform vec4 hideRadius;
  varying vec2 vUv;
  varying float vVisible;

  float unpackDepth(vec4 packedColor) {
    float value =
      floor(packedColor.r * 255.0 + 0.5) * 256.0 +
      floor(packedColor.g * 255.0 + 0.5);
    return value * depthScale;
  }

  void main() {
    vec2 pixel = position.xy;
    vec2 uv = vec2(
      (pixel.x + 0.5) / resolution.x,
      1.0 - (pixel.y + 0.5) / resolution.y
    );
    vUv = uv;
    float depth = unpackDepth(texture2D(depthMap, uv));
    if (depth <= 0.001) {
      vVisible = 0.0;
      gl_PointSize = 0.0;
      gl_Position = vec4(0.0);
      return;
    }
    float x = ((pixel.x - K.z) / K.x) * depth;
    float y = -((pixel.y - K.w) / K.y) * depth;
    vec3 world = vec3(x, y, -depth);
    if (hideRadius.w > 0.0 && distance(world, hideCenter) < hideRadius.w) {
      vVisible = 0.0;
      gl_PointSize = 0.0;
      gl_Position = vec4(0.0);
      return;
    }
    vVisible = 1.0;
    vec4 projected = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
    gl_Position = projected;
    gl_PointSize = max(1.2, 180.0 / max(projected.w, 0.08));
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D rgbMap;
  varying vec2 vUv;
  varying float vVisible;

  void main() {
    if (vVisible < 0.5) {
      discard;
    }
    gl_FragColor = vec4(texture2D(rgbMap, vUv).rgb, 1.0);
  }
`;

function createPixelGeometry(width: number, height: number): THREE.BufferGeometry {
  const count = width * height;
  const positions = new Float32Array(count * 3);
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      positions[offset] = x;
      positions[offset + 1] = y;
      positions[offset + 2] = 0;
      offset += 3;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

export interface VideoPointCloudProps {
  manifest: PovManifest;
  rgbMap: THREE.Texture;
  depthMap: THREE.Texture;
  timeSource: MatchTimeSource;
  side: ShotPlayerSide;
}

export function VideoPointCloud({
  manifest,
  rgbMap,
  depthMap,
  timeSource,
  side,
}: VideoPointCloudProps) {
  const geometry = useMemo(
    () => createPixelGeometry(manifest.width, manifest.height),
    [manifest.height, manifest.width],
  );
  const uniforms = useMemo(
    () => ({
      rgbMap: { value: rgbMap },
      depthMap: { value: depthMap },
      resolution: {
        value: new THREE.Vector2(manifest.width, manifest.height),
      },
      K: {
        value: new THREE.Vector4(
          manifest.K[0],
          manifest.K[1],
          manifest.K[2],
          manifest.K[3],
        ),
      },
      depthScale: { value: manifest.depthScale },
      hideCenter: { value: new THREE.Vector3() },
      hideRadius: { value: new THREE.Vector4() },
    }),
    [depthMap, manifest, rgbMap],
  );
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(() => {
    const material = materialRef.current;
    if (!material) {
      return;
    }
    const pose = interpolatePovTrack(
      manifest.tracks,
      getPovSampleTime(timeSource.current),
      side,
    );
    const hideCenter = material.uniforms.hideCenter.value as THREE.Vector3;
    const hideRadius = material.uniforms.hideRadius.value as THREE.Vector4;
    if (pose.standby) {
      hideRadius.w = 0;
      return;
    }
    hideCenter.set(...pose.position);
    hideRadius.w = manifest.hideRadius ?? 0.45;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        depthTest
        depthWrite
        toneMapped={false}
      />
    </points>
  );
}
