import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StreamContainer } from '../components/stream/StreamContainer';
import type { StreamContainerRef } from '../components/stream/StreamContainer';
import { LiveBadge } from '../components/stream/LiveBadge';
import { VideoControls } from '../components/stream/VideoControls';
import { AccessibilityToggle } from '../components/shared/AccessibilityToggle';
import { CameraRail } from '../components/tennis/CameraRail';
import {
  PlacedCameraCard,
  PresetCameraCard,
} from '../components/tennis/CameraCard';
import { GhostControls } from '../components/tennis/GhostControls';
import { PlacementMode } from '../components/tennis/PlacementMode';
import { POVCard } from '../components/tennis/POVCard';
import { ReplayOverlay } from '../components/tennis/ReplayOverlay';
import { TennisScoreboard } from '../components/tennis/TennisScoreboard';
import { useAccessibility } from '../contexts/AccessibilityContext';
import {
  TENNIS_MATCH,
  getCompiledTennisMatch,
  type CompiledPoint,
} from '../data/tennis/match';
import { useMatchState } from '../hooks/useMatchState';
import { replayMeasurement } from '../lib/tennis/replay';
import { createPlacedCamera, type PlacedCamera } from '../scene/cameras/placement';
import {
  PRESET_CAMERA_IDS,
  type PresetCameraId,
} from '../scene/cameras/presets';
import { SceneRoot } from '../scene/SceneRoot';
import '../App.css';
import '../components/tennis/pov-card.css';
import '../components/tennis/tennis-shell.css';

const UI_CLOCK_INTERVAL_MS = 100;

export function StreamPage() {
  const navigate = useNavigate();
  const { announce } = useAccessibility();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetCameraId | null>(null);
  const [placedCameras, setPlacedCameras] = useState<PlacedCamera[]>([]);
  const [placementMode, setPlacementMode] = useState(false);
  const [placementHeight, setPlacementHeight] = useState(1.8);
  const [placementTrack, setPlacementTrack] = useState(true);
  const [ghostMode, setGhostMode] = useState(false);
  const [worldFrozen, setWorldFrozen] = useState(false);
  const [replayPoint, setReplayPoint] = useState<CompiledPoint | null>(null);

  const streamRef = useRef<StreamContainerRef>(null);
  const liveTime = useRef(0);
  const sceneTime = useRef(0);
  const lastUIClockUpdateRef = useRef(-Infinity);
  const compiledMatch = useMemo(() => getCompiledTennisMatch(), []);
  const replayOpen = replayPoint !== null;
  const worldFrozenRef = useRef(false);
  const replayOpenRef = useRef(false);

  useEffect(() => {
    worldFrozenRef.current = worldFrozen;
    replayOpenRef.current = replayOpen;
  }, [replayOpen, worldFrozen]);

  const handleTimeUpdate = useCallback((time: number, dur: number) => {
    liveTime.current = time;
    if (!worldFrozenRef.current && !replayOpenRef.current) {
      sceneTime.current = time;
    }

    const now = performance.now();
    if (now - lastUIClockUpdateRef.current >= UI_CLOCK_INTERVAL_MS) {
      lastUIClockUpdateRef.current = now;
      setCurrentTime(time);
      setDuration(dur);
    }
  }, []);

  const handlePointEnd = useCallback((point: CompiledPoint) => {
    streamRef.current?.pause();
    setGhostMode(false);
    setPlacementMode(false);
    setReplayPoint(point);
    const measurement = replayMeasurement(point);
    announce(
      `${point.point.replayLabel}. ${measurement.display}.`,
      'assertive',
    );
  }, [announce]);

  const matchState = useMatchState({
    mediaTime: currentTime,
    compiledMatch,
    enabled: !replayOpen,
    onPointEnd: handlePointEnd,
  });

  const handleStateChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  const handlePlayPause = () => {
    if (isPlaying) {
      streamRef.current?.pause();
    } else {
      streamRef.current?.play();
    }
  };

  const handleSeek = (time: number) => {
    liveTime.current = time;
    if (!worldFrozen) {
      sceneTime.current = time;
    }
    lastUIClockUpdateRef.current = performance.now();
    setCurrentTime(time);
    streamRef.current?.seekTo(time);
  };

  const dismissReplay = useCallback(() => {
    setReplayPoint(null);
    streamRef.current?.play();
    announce('Broadcast resumed.', 'polite');
  }, [announce]);

  const handleFrozenChange = useCallback((frozen: boolean) => {
    if (frozen) {
      sceneTime.current = liveTime.current;
    }
    setWorldFrozen(frozen);
    announce(frozen ? 'Court frozen.' : 'Court live.', 'polite');
  }, [announce]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (replayOpen || ghostMode || placementMode) {
        return;
      }
      if (event.key === 'g' || event.key === 'G') {
        event.preventDefault();
        setPlacementMode(false);
        setGhostMode(true);
        announce('Ghost explore mode.', 'polite');
      }
      if (event.key === 'p' || event.key === 'P') {
        event.preventDefault();
        setGhostMode(false);
        setPlacementMode(true);
        announce('Camera placement mode. Click the court to pin a camera.', 'polite');
      }
      if (/^[1-6]$/.test(event.key)) {
        const preset = PRESET_CAMERA_IDS[Number(event.key) - 1];
        if (preset) {
          setActivePreset((current) => (current === preset ? null : preset));
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [announce, ghostMode, placementMode, replayOpen]);

  const handlePlace = (x: number, z: number) => {
    const camera = createPlacedCamera({
      x,
      z,
      height: placementHeight,
      trackBall: placementTrack,
    });
    setPlacedCameras((current) => [...current, camera]);
    announce('Pinned camera added.', 'polite');
  };

  return (
    <div className="app">
      <StreamContainer
        ref={streamRef}
        youtubeId={TENNIS_MATCH.source.youtubeId}
        onTimeUpdate={handleTimeUpdate}
        onStateChange={handleStateChange}
      >
        <SceneRoot className="tennis-pov-layer">
          <div className="tennis-pov-cards">
            <POVCard
              side="near"
              timeSource={sceneTime}
              currentTime={currentTime}
              compiledMatch={compiledMatch}
            />
            <POVCard
              side="far"
              timeSource={sceneTime}
              currentTime={currentTime}
              compiledMatch={compiledMatch}
            />
          </div>

          {activePreset ? (
            <PresetCameraCard
              presetId={activePreset}
              timeSource={sceneTime}
              compiledMatch={compiledMatch}
              index={10}
            />
          ) : null}

          {placedCameras.length > 0 ? (
            <div className="camera-stack">
              {placedCameras.map((camera, index) => (
                <PlacedCameraCard
                  key={camera.id}
                  camera={camera}
                  timeSource={sceneTime}
                  compiledMatch={compiledMatch}
                  index={20 + index}
                  onHeightChange={(height) => {
                    setPlacedCameras((current) =>
                      current.map((item) =>
                        item.id === camera.id ? { ...item, height } : item,
                      ),
                    );
                  }}
                  onTrackChange={(trackBall) => {
                    setPlacedCameras((current) =>
                      current.map((item) =>
                        item.id === camera.id ? { ...item, trackBall } : item,
                      ),
                    );
                  }}
                  onRemove={() => {
                    setPlacedCameras((current) =>
                      current.filter((item) => item.id !== camera.id),
                    );
                  }}
                />
              ))}
            </div>
          ) : null}

          {placementMode ? (
            <PlacementMode
              timeSource={sceneTime}
              compiledMatch={compiledMatch}
              height={placementHeight}
              trackBall={placementTrack}
              onHeightChange={setPlacementHeight}
              onTrackChange={setPlacementTrack}
              onPlace={handlePlace}
              onClose={() => setPlacementMode(false)}
            />
          ) : null}

          {ghostMode ? (
            <GhostControls
              timeSource={sceneTime}
              compiledMatch={compiledMatch}
              frozen={worldFrozen}
              onFrozenChange={handleFrozenChange}
              onExit={() => {
                setGhostMode(false);
                setWorldFrozen(false);
              }}
            />
          ) : null}

          {replayPoint ? (
            <ReplayOverlay
              key={replayPoint.point.id}
              compiledPoint={replayPoint}
              compiledMatch={compiledMatch}
              onDismiss={dismissReplay}
            />
          ) : null}
        </SceneRoot>

        <TennisScoreboard
          match={compiledMatch.match}
          score={matchState.score}
          currentPoint={matchState.currentPoint}
        />

        {!replayOpen && !ghostMode && !placementMode ? (
        <CameraRail
          activePreset={activePreset}
          placementActive={placementMode}
          ghostActive={ghostMode}
          onSelectPreset={(id) =>
            setActivePreset((current) => (current === id ? null : id))
          }
          onTogglePlacement={() => {
            setGhostMode(false);
            setPlacementMode((value) => !value);
          }}
          onToggleGhost={() => {
            setPlacementMode(false);
            setGhostMode((value) => !value);
          }}
        />
        ) : null}

        <button
          className="home-button"
          onClick={() => navigate('/')}
          aria-label="Return to home"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span>Back</span>
        </button>

        <LiveBadge />

        <VideoControls
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onSeek={handleSeek}
          onFullscreen={() => {
            document.documentElement.requestFullscreen?.();
          }}
        />
      </StreamContainer>

      <AccessibilityToggle />
    </div>
  );
}
