import { useEffect, useRef, forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useMatchClock } from '../../hooks/useMatchClock';
import {
  callYouTubePlayer,
  readYouTubePlayerNumber,
  type InitializingYouTubePlayer,
} from './youtubePlayer';
import './styles.css';

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

export interface StreamContainerRef {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getVideoElement: () => HTMLVideoElement | null;
}

interface StreamContainerProps {
  children: ReactNode;
  youtubeId?: string;
  videoSrc?: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onStateChange?: (isPlaying: boolean) => void;
  onVideoElement?: (video: HTMLVideoElement | null) => void;
}

export const StreamContainer = forwardRef<StreamContainerRef, StreamContainerProps>(
  ({ children, youtubeId, videoSrc, onTimeUpdate, onStateChange, onVideoElement }, ref) => {
    const playerRef = useRef<InitializingYouTubePlayer | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const onTimeUpdateRef = useRef(onTimeUpdate);
    const onStateChangeRef = useRef(onStateChange);

    useEffect(() => {
      onTimeUpdateRef.current = onTimeUpdate;
      onStateChangeRef.current = onStateChange;
    });

    const getCurrentTime = useCallback(() => {
      if (videoSrc && videoRef.current) {
        return videoRef.current.currentTime;
      }
      return readYouTubePlayerNumber(playerRef.current, 'getCurrentTime', 0);
    }, [videoSrc]);

    const getDuration = useCallback(() => {
      if (videoSrc && videoRef.current) {
        return videoRef.current.duration || 0;
      }
      return readYouTubePlayerNumber(playerRef.current, 'getDuration', 0);
    }, [videoSrc]);

    const handleTick = useCallback((currentTime: number, duration: number) => {
      onTimeUpdateRef.current?.(currentTime, duration);
    }, []);

    const { sync } = useMatchClock({
      getCurrentTime,
      getDuration,
      playing: isPlaying,
      enabled: !!(youtubeId || videoSrc),
      onTick: handleTick,
    });

    const syncRef = useRef(sync);

    useEffect(() => {
      syncRef.current = sync;
    }, [sync]);

    const applyPlaybackState = useCallback((playing: boolean) => {
      setIsPlaying(playing);
      onStateChangeRef.current?.(playing);
      syncRef.current(playing);
    }, []);

    useImperativeHandle(ref, () => ({
      play: () => {
        if (videoSrc && videoRef.current) {
          void videoRef.current.play();
        } else {
          callYouTubePlayer(playerRef.current, 'playVideo');
        }
      },
      pause: () => {
        if (videoSrc && videoRef.current) {
          videoRef.current.pause();
        } else {
          callYouTubePlayer(playerRef.current, 'pauseVideo');
        }
      },
      seekTo: (seconds: number) => {
        if (videoSrc && videoRef.current) {
          videoRef.current.currentTime = seconds;
        } else {
          callYouTubePlayer(playerRef.current, 'seekTo', seconds, true);
        }
        syncRef.current();
      },
      getCurrentTime: () => getCurrentTime(),
      getDuration: () => getDuration(),
      getPlayerState: () => {
        if (videoSrc && videoRef.current) {
          return videoRef.current.paused ? 2 : 1;
        }
        return readYouTubePlayerNumber(
          playerRef.current,
          'getPlayerState',
          -1,
        );
      },
      getVideoElement: () => (videoSrc ? videoRef.current : null),
    }));

    // Handle native video element
    useEffect(() => {
      if (!videoSrc || !videoRef.current) return;

      const video = videoRef.current;

      const syncNativePlaybackState = () => {
        const playing = !video.paused && !video.ended;
        applyPlaybackState(playing);
      };

      const handlePlay = () => {
        applyPlaybackState(true);
      };

      const handlePause = () => {
        applyPlaybackState(false);
      };

      const handleSeeked = () => {
        syncRef.current();
      };

      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('seeked', handleSeeked);

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        syncNativePlaybackState();
      } else {
        video.addEventListener('loadeddata', syncNativePlaybackState, { once: true });
      }

      onVideoElement?.(video);

      return () => {
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('seeked', handleSeeked);
        video.removeEventListener('loadeddata', syncNativePlaybackState);
        onVideoElement?.(null);
      };
    }, [videoSrc, applyPlaybackState, onVideoElement]);

    useEffect(() => {
      if (!youtubeId) return;

      // Load YouTube IFrame API
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        playerRef.current = new window.YT.Player('youtube-player', {
          videoId: youtubeId,
          playerVars: {
            autoplay: 1,
            mute: 1,
            controls: 0,
            showinfo: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            loop: 1,
            playlist: youtubeId,
          },
          events: {
            onReady: (event) => {
              playerRef.current = event.target;
              event.target.playVideo();
              applyPlaybackState(true);
            },
            onStateChange: (event) => {
              const playing = event.data === window.YT.PlayerState.PLAYING;
              applyPlaybackState(playing);
            },
          },
        });
      };

      // If API already loaded
      if (window.YT && window.YT.Player) {
        window.onYouTubeIframeAPIReady();
      }

      return () => {
        callYouTubePlayer(playerRef.current, 'destroy');
      };
    }, [youtubeId, applyPlaybackState]);

    return (
      <div className="stream-container" ref={containerRef}>
        <div className="stream-video-wrapper">
          {youtubeId ? (
            <div id="youtube-player" className="stream-video youtube-embed" />
          ) : videoSrc ? (
            <video
              ref={videoRef}
              className="stream-video"
              src={videoSrc}
              autoPlay
              muted
              loop
              playsInline
              onLoadedMetadata={(event) => {
                onVideoElement?.(event.currentTarget);
              }}
            />
          ) : (
            <div className="stream-video-placeholder">
              <div className="field-lines">
                <div className="field-center-circle" />
                <div className="field-center-line" />
                <div className="field-penalty-left" />
                <div className="field-penalty-right" />
                <div className="field-goal-left" />
                <div className="field-goal-right" />
              </div>
            </div>
          )}
          <div className="stream-overlay">{children}</div>
        </div>
      </div>
    );
  }
);

StreamContainer.displayName = 'StreamContainer';
