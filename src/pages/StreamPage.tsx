import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { StreamContainer } from '../components/stream/StreamContainer';
import type { StreamContainerRef } from '../components/stream/StreamContainer';
import { LiveBadge } from '../components/stream/LiveBadge';
import { VideoControls } from '../components/stream/VideoControls';
import { AccessibilityToggle } from '../components/shared/AccessibilityToggle';
import brunoVideo from '../assets/bruno.mov';
import '../App.css';

export function StreamPage() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const streamRef = useRef<StreamContainerRef>(null);

  const handleTimeUpdate = useCallback((time: number, dur: number) => {
    setCurrentTime(time);
    setDuration(dur);
  }, []);

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
    streamRef.current?.seekTo(time);
  };

  const handleFullscreen = () => {
    document.documentElement.requestFullscreen?.();
  };

  return (
    <div className="app">
      <StreamContainer
        ref={streamRef}
        videoSrc={brunoVideo}
        onTimeUpdate={handleTimeUpdate}
        onStateChange={handleStateChange}
      >
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
          onFullscreen={handleFullscreen}
        />
      </StreamContainer>

      <AccessibilityToggle />
    </div>
  );
}
