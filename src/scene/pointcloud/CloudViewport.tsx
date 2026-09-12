import { type CSSProperties } from 'react';
import { View } from '@react-three/drei';
import type { MatchTimeSource } from '../../lib/tennis/animation';
import type { ShotPlayerSide } from '../../lib/tennis/trajectory';
import { PlayerCloudCamera } from './PlayerCloudCamera';
import { usePovReconstruction } from './PovReconstruction';
import { VideoPointCloud } from './VideoPointCloud';

const VIEW_STYLE: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  width: '100%',
  height: '100%',
  minHeight: 0,
  pointerEvents: 'none',
};

export interface CloudViewportProps {
  className?: string;
  timeSource: MatchTimeSource;
  side: ShotPlayerSide;
  index?: number;
}

export function CloudViewport({
  className,
  timeSource,
  side,
  index = 1,
}: CloudViewportProps) {
  const reconstruction = usePovReconstruction();
  if (!reconstruction?.rgbMap || !reconstruction.depthMap) {
    return <div className={className} style={VIEW_STYLE} />;
  }

  return (
    <View className={className} style={VIEW_STYLE} frames={Infinity} index={index}>
      <color attach="background" args={['#08110e']} />
      <VideoPointCloud
        manifest={reconstruction.manifest}
        rgbMap={reconstruction.rgbMap}
        depthMap={reconstruction.depthMap}
        timeSource={timeSource}
        side={side}
      />
      <PlayerCloudCamera
        side={side}
        timeSource={timeSource}
        manifest={reconstruction.manifest}
      />
    </View>
  );
}
