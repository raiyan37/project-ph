import { useEffect, useMemo, useRef } from 'react';
import type { CompiledPoint, CompiledTennisMatch } from '../data/tennis/match';
import {
  getMatchSnapshot,
  pointEndedBetween,
  type MatchSnapshot,
} from '../lib/tennis/matchState';

export interface UseMatchStateOptions {
  mediaTime: number;
  compiledMatch: CompiledTennisMatch;
  enabled?: boolean;
  onPointEnd?: (point: CompiledPoint) => void;
}

export function useMatchState({
  mediaTime,
  compiledMatch,
  enabled = true,
  onPointEnd,
}: UseMatchStateOptions): MatchSnapshot {
  const snapshot = useMemo(
    () => getMatchSnapshot(mediaTime, compiledMatch),
    [compiledMatch, mediaTime],
  );
  const previousTimeRef = useRef(mediaTime);
  const onPointEndRef = useRef(onPointEnd);

  useEffect(() => {
    onPointEndRef.current = onPointEnd;
  }, [onPointEnd]);

  useEffect(() => {
    if (!enabled) {
      previousTimeRef.current = mediaTime;
      return;
    }
    const ended = pointEndedBetween(
      previousTimeRef.current,
      mediaTime,
      compiledMatch,
    );
    previousTimeRef.current = mediaTime;
    if (ended) {
      onPointEndRef.current?.(ended);
    }
  }, [compiledMatch, enabled, mediaTime]);

  return snapshot;
}
