import { useCallback, useEffect, useRef } from 'react';

const RESAMPLE_INTERVAL_MS = 250;

export interface InterpolatedMediaClockOptions {
  time?: number;
  duration?: number;
  playing?: boolean;
}

export class InterpolatedMediaClock {
  private anchorTime = 0;
  private anchorPerformanceTime = 0;
  private playing = false;
  private duration = 0;

  constructor(options: InterpolatedMediaClockOptions = {}) {
    this.anchorTime = options.time ?? 0;
    this.duration = options.duration ?? 0;
    this.playing = options.playing ?? false;
  }

  reanchor(time: number, performanceTime: number): void {
    this.anchorTime = this.clamp(time);
    this.anchorPerformanceTime = performanceTime;
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
  }

  setDuration(duration: number): void {
    this.duration = Math.max(0, duration);
    this.anchorTime = this.clamp(this.anchorTime);
  }

  getTime(performanceTime: number): number {
    if (performanceTime < this.anchorPerformanceTime) {
      return this.clamp(this.anchorTime);
    }

    if (!this.playing) {
      return this.clamp(this.anchorTime);
    }

    const elapsedSeconds = (performanceTime - this.anchorPerformanceTime) / 1000;
    return this.clamp(this.anchorTime + elapsedSeconds);
  }

  private clamp(time: number): number {
    if (this.duration <= 0) {
      return Math.max(time, 0);
    }
    return Math.min(Math.max(time, 0), this.duration);
  }
}

export interface UseMatchClockOptions {
  getCurrentTime: () => number;
  getDuration: () => number;
  playing: boolean;
  enabled?: boolean;
  onTick: (currentTime: number, duration: number) => void;
}

export interface UseMatchClockResult {
  sync: (playing?: boolean) => void;
}

export function useMatchClock({
  getCurrentTime,
  getDuration,
  playing,
  enabled = true,
  onTick,
}: UseMatchClockOptions): UseMatchClockResult {
  const clockRef = useRef(new InterpolatedMediaClock());
  const rafRef = useRef<number | null>(null);
  const lastSampleRef = useRef(0);
  const playingRef = useRef(playing);

  const getCurrentTimeRef = useRef(getCurrentTime);
  const getDurationRef = useRef(getDuration);
  const onTickRef = useRef(onTick);

  useEffect(() => {
    getCurrentTimeRef.current = getCurrentTime;
    getDurationRef.current = getDuration;
    onTickRef.current = onTick;
  });

  useEffect(() => {
    playingRef.current = playing;
    clockRef.current.setPlaying(playing);
  }, [playing]);

  const sync = useCallback((nextPlaying?: boolean) => {
    const now = performance.now();

    if (nextPlaying !== undefined) {
      playingRef.current = nextPlaying;
      clockRef.current.setPlaying(nextPlaying);
    }

    const duration = getDurationRef.current();
    const time = getCurrentTimeRef.current();

    clockRef.current.setDuration(duration);
    clockRef.current.reanchor(time, now);
    lastSampleRef.current = now;
    onTickRef.current(clockRef.current.getTime(now), duration);
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const tick = (now: number) => {
      const duration = getDurationRef.current();
      clockRef.current.setDuration(duration);

      if (now - lastSampleRef.current >= RESAMPLE_INTERVAL_MS) {
        clockRef.current.reanchor(getCurrentTimeRef.current(), now);
        lastSampleRef.current = now;
      }

      onTickRef.current(clockRef.current.getTime(now), duration);
      rafRef.current = requestAnimationFrame(tick);
    };

    sync();
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled, sync]);

  return { sync };
}
