import {
  useRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { Canvas } from '@react-three/fiber';
import { View } from '@react-three/drei';
import type { CompiledTennisMatch } from '../data/tennis/match';
import type { MatchTimeSource } from '../lib/tennis/animation';
import type { ShotPlayerSide } from '../lib/tennis/trajectory';
import { LookAtCamera } from './cameras/LookAtCamera';
import { CourtScene, type CourtOverlay } from './CourtScene';

const DPR_RANGE: [number, number] = [1, 2];
const DEFAULT_CAMERA_POSITION = [10, 18, -27] as const;
const DEFAULT_CAMERA_TARGET = [0, 0.8, 1] as const;

const ROOT_STYLE: CSSProperties = {
  position: 'relative',
  isolation: 'isolate',
  width: '100%',
  height: '100%',
  minHeight: 0,
  overflow: 'hidden',
  background: 'transparent',
  pointerEvents: 'none',
};

const VIEW_STYLE: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  width: '100%',
  height: '100%',
  minHeight: 0,
  pointerEvents: 'none',
};

const CANVAS_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 5,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
};

type CameraVector = readonly [number, number, number];

export interface SceneRootProps
  extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  /** DOM View elements are rendered over the shared full-cover Canvas. */
  children: ReactNode;
}

export function SceneRoot({
  children,
  className,
  style,
  ...rootProps
}: SceneRootProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      {...rootProps}
      ref={containerRef}
      className={className}
      style={{ ...ROOT_STYLE, ...style }}
    >
      {children}
      <Canvas
        dpr={DPR_RANGE}
        shadows="basic"
        eventSource={containerRef as RefObject<HTMLElement>}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        }}
        style={CANVAS_STYLE}
      >
        <View.Port />
      </Canvas>
    </div>
  );
}

export interface CourtViewportProps {
  className?: string;
  style?: CSSProperties;
  timeSource: MatchTimeSource;
  compiledMatch: CompiledTennisMatch;
  povSide?: ShotPlayerSide;
  cameraPosition?: CameraVector;
  cameraTarget?: CameraVector;
  cameraRig?: ReactNode;
  cameraChildren?: ReactNode;
  overlay?: CourtOverlay;
  interactive?: boolean;
  frames?: number;
  index?: number;
  children?: ReactNode;
}

export function CourtViewport({
  className,
  style,
  timeSource,
  compiledMatch,
  povSide,
  cameraPosition = DEFAULT_CAMERA_POSITION,
  cameraTarget = DEFAULT_CAMERA_TARGET,
  cameraRig,
  cameraChildren,
  overlay,
  interactive = false,
  frames = Infinity,
  index = 1,
  children,
}: CourtViewportProps) {
  return (
    <View
      className={className}
      style={{
        ...VIEW_STYLE,
        pointerEvents: interactive ? 'auto' : 'none',
        ...style,
      }}
      frames={frames}
      index={index}
    >
      <CourtScene
        timeSource={timeSource}
        compiledMatch={compiledMatch}
        povSide={povSide}
        overlay={overlay}
      >
        {children}
      </CourtScene>
      {cameraRig === undefined ? (
        <LookAtCamera
          position={cameraPosition}
          target={cameraTarget}
          fov={45}
        >
          {cameraChildren}
        </LookAtCamera>
      ) : (
        cameraRig
      )}
    </View>
  );
}
