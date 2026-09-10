import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  DOUBLES_HALF_WIDTH,
  NET_HEIGHT_CENTER,
  NET_HEIGHT_POST,
  netHeightAt,
  netTapeVerticalRange,
} from '../lib/tennis/court';

const NET_COLOR = '#e8e8e4';
const TAPE_COLOR = '#f8f8f6';
const POST_COLOR = '#2a2a2a';
const STRAP_COLOR = '#f8f8f6';

const NET_SEGMENTS = 32;
const TAPE_DEPTH = 0.04;
const POST_RADIUS = 0.04;
const STRAP_WIDTH = 0.06;
const STRAP_DEPTH = 0.02;

function buildNetGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= NET_SEGMENTS; i++) {
    const t = i / NET_SEGMENTS;
    const x = -DOUBLES_HALF_WIDTH + t * 2 * DOUBLES_HALF_WIDTH;
    const topY = netHeightAt(x);

    positions.push(x, 0, 0);
    positions.push(x, topY, 0);
  }

  for (let i = 0; i < NET_SEGMENTS; i++) {
    const base = i * 2;
    indices.push(base, base + 1, base + 2);
    indices.push(base + 1, base + 3, base + 2);
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildTapeGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= NET_SEGMENTS; i++) {
    const t = i / NET_SEGMENTS;
    const x = -DOUBLES_HALF_WIDTH + t * 2 * DOUBLES_HALF_WIDTH;
    const { bottomY, topY } = netTapeVerticalRange(x);

    positions.push(x, bottomY, -TAPE_DEPTH / 2);
    positions.push(x, topY, -TAPE_DEPTH / 2);
  }

  for (let i = 0; i < NET_SEGMENTS; i++) {
    const base = i * 2;
    indices.push(base, base + 1, base + 2);
    indices.push(base + 1, base + 3, base + 2);
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export interface NetProps {
  /** Lateral offset if the net group should be repositioned. */
  position?: [number, number, number];
}

export function Net({ position = [0, 0, 0] }: NetProps) {
  const netGeometry = useMemo(() => buildNetGeometry(), []);
  const tapeGeometry = useMemo(() => buildTapeGeometry(), []);

  useEffect(
    () => () => {
      netGeometry.dispose();
      tapeGeometry.dispose();
    },
    [netGeometry, tapeGeometry],
  );

  return (
    <group name="net" position={position}>
      <mesh name="net-mesh" geometry={netGeometry}>
        <meshStandardMaterial
          color={NET_COLOR}
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh name="net-tape" geometry={tapeGeometry}>
        <meshStandardMaterial color={TAPE_COLOR} side={THREE.DoubleSide} />
      </mesh>

      <mesh
        name="net-post-near"
        position={[-DOUBLES_HALF_WIDTH, NET_HEIGHT_POST / 2, 0]}
      >
        <cylinderGeometry args={[POST_RADIUS, POST_RADIUS, NET_HEIGHT_POST, 12]} />
        <meshStandardMaterial color={POST_COLOR} metalness={0.3} roughness={0.6} />
      </mesh>

      <mesh
        name="net-post-far"
        position={[DOUBLES_HALF_WIDTH, NET_HEIGHT_POST / 2, 0]}
      >
        <cylinderGeometry args={[POST_RADIUS, POST_RADIUS, NET_HEIGHT_POST, 12]} />
        <meshStandardMaterial color={POST_COLOR} metalness={0.3} roughness={0.6} />
      </mesh>

      <mesh
        name="net-center-strap"
        position={[0, NET_HEIGHT_CENTER / 2, -STRAP_DEPTH / 2]}
      >
        <boxGeometry args={[STRAP_WIDTH, NET_HEIGHT_CENTER, STRAP_DEPTH]} />
        <meshStandardMaterial color={STRAP_COLOR} />
      </mesh>
    </group>
  );
}
