import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as THREE from 'three';
import type { MatchTimeSource } from '../../lib/tennis/animation';
import { getPovSampleTime } from '../../lib/tennis/streamMedia';
import type { PovManifest } from './types';

const DRIFT_SECONDS = 0.08;

interface PovReconstructionValue {
  readonly manifest: PovManifest;
  readonly rgbMap: THREE.VideoTexture | null;
  readonly depthMap: THREE.VideoTexture | null;
}

const PovReconstructionContext = createContext<PovReconstructionValue | null>(
  null,
);

// The provider and hook are colocated so viewports can share one RGB-D pair.
// eslint-disable-next-line react-refresh/only-export-components
export function usePovReconstruction(): PovReconstructionValue | null {
  return useContext(PovReconstructionContext);
}

export interface PovReconstructionProviderProps {
  manifest: PovManifest | null;
  rgbVideo: HTMLVideoElement | null;
  timeSource: MatchTimeSource;
  playing: boolean;
  children: ReactNode;
}

function syncVideo(
  video: HTMLVideoElement,
  time: number,
  playing: boolean,
): void {
  const target = getPovSampleTime(time);
  if (Math.abs(video.currentTime - target) > DRIFT_SECONDS) {
    video.currentTime = target;
  }
  if (playing && video.paused) {
    void video.play().catch(() => undefined);
  } else if (!playing && !video.paused) {
    video.pause();
  }
}

export function PovReconstructionProvider({
  manifest,
  rgbVideo,
  timeSource,
  playing,
  children,
}: PovReconstructionProviderProps) {
  const depthRef = useRef<HTMLVideoElement>(null);
  const [depthVideo, setDepthVideo] = useState<HTMLVideoElement | null>(null);

  useEffect(() => {
    setDepthVideo(depthRef.current);
  }, [manifest?.depthUrl]);

  useEffect(() => {
    if (!manifest) {
      return;
    }
    let frame = 0;
    const tick = () => {
      if (depthRef.current) {
        syncVideo(depthRef.current, timeSource.current, playing);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [manifest, playing, timeSource]);

  const textures = useMemo(() => {
    if (!rgbVideo || !depthVideo) {
      return { rgbMap: null, depthMap: null };
    }
    const rgbMap = new THREE.VideoTexture(rgbVideo);
    rgbMap.colorSpace = THREE.SRGBColorSpace;
    const depthMap = new THREE.VideoTexture(depthVideo);
    depthMap.colorSpace = THREE.NoColorSpace;
    depthMap.minFilter = THREE.NearestFilter;
    depthMap.magFilter = THREE.NearestFilter;
    depthMap.generateMipmaps = false;
    return { rgbMap, depthMap };
  }, [depthVideo, rgbVideo]);

  useEffect(() => {
    return () => {
      textures.rgbMap?.dispose();
      textures.depthMap?.dispose();
    };
  }, [textures]);

  const value = useMemo<PovReconstructionValue | null>(() => {
    if (!manifest) {
      return null;
    }
    return {
      manifest,
      rgbMap: textures.rgbMap,
      depthMap: textures.depthMap,
    };
  }, [manifest, textures]);

  return (
    <PovReconstructionContext.Provider value={value}>
      {manifest ? (
        <video
          ref={depthRef}
          className="pov-depth-video"
          src={manifest.depthUrl}
          muted
          playsInline
          preload="auto"
          loop
          onLoadedData={() => setDepthVideo(depthRef.current)}
        />
      ) : null}
      {children}
    </PovReconstructionContext.Provider>
  );
}
