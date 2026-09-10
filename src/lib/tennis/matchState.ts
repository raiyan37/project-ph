import type { CompiledPoint, CompiledTennisMatch } from '../../data/tennis/match';
import { tennisGameScore, type GameScore } from './score';

export interface MatchSnapshot {
  readonly mediaTime: number;
  readonly currentPoint: CompiledPoint | undefined;
  readonly currentPointIndex: number | undefined;
  readonly completedPointCount: number;
  readonly score: GameScore;
}

function assertFiniteMediaTime(mediaTime: number): void {
  if (!Number.isFinite(mediaTime)) {
    throw new Error('Match media time must be finite.');
  }
}

export function getMatchSnapshot(
  mediaTime: number,
  compiled: CompiledTennisMatch,
): MatchSnapshot {
  assertFiniteMediaTime(mediaTime);

  let completedPointCount = 0;
  let currentPoint: CompiledPoint | undefined;
  let currentPointIndex: number | undefined;

  compiled.points.forEach((compiledPoint, index) => {
    if (mediaTime >= compiledPoint.point.endT) {
      completedPointCount = index + 1;
      return;
    }
    if (
      currentPoint === undefined &&
      mediaTime >= compiledPoint.point.startT &&
      mediaTime < compiledPoint.point.endT
    ) {
      currentPoint = compiledPoint;
      currentPointIndex = index;
    }
  });

  return {
    mediaTime,
    currentPoint,
    currentPointIndex,
    completedPointCount,
    score: tennisGameScore(compiled.match, completedPointCount),
  };
}

const SEEK_JUMP_SECONDS = 1;

export function pointEndedBetween(
  previousTime: number,
  nextTime: number,
  compiled: CompiledTennisMatch,
): CompiledPoint | undefined {
  assertFiniteMediaTime(previousTime);
  assertFiniteMediaTime(nextTime);

  if (nextTime <= previousTime || nextTime - previousTime > SEEK_JUMP_SECONDS) {
    return undefined;
  }

  return compiled.points.find(
    (compiledPoint) =>
      previousTime < compiledPoint.point.endT &&
      nextTime >= compiledPoint.point.endT,
  );
}
