import type { ShotPlayerSide } from './trajectory';
import type { TennisMatch, TennisPlayerId } from '../../data/tennis/match';

export type PointValue = 0 | 15 | 30 | 40;

export interface GameScore {
  readonly near: PointValue;
  readonly far: PointValue;
  readonly nearLabel: string;
  readonly farLabel: string;
  readonly winner: ShotPlayerSide | null;
  readonly complete: boolean;
}

const POINT_VALUES: readonly PointValue[] = [0, 15, 30, 40];

export function formatPointValue(value: PointValue): string {
  return String(value);
}

function sideForPlayer(
  match: TennisMatch,
  playerId: TennisPlayerId,
): ShotPlayerSide {
  if (match.players.near.id === playerId) {
    return 'near';
  }
  if (match.players.far.id === playerId) {
    return 'far';
  }
  throw new Error(`Unknown tennis player "${playerId}".`);
}

function gameReached(points: number, opponent: number): boolean {
  return points >= 4 && points - opponent >= 2;
}

export function tennisGameScore(
  match: TennisMatch,
  completedPointCount: number,
): GameScore {
  if (!Number.isFinite(completedPointCount) || completedPointCount < 0) {
    throw new Error('Completed point count must be a finite non-negative number.');
  }

  let nearPoints = 0;
  let farPoints = 0;
  const limit = Math.min(Math.floor(completedPointCount), match.points.length);

  for (let index = 0; index < limit; index += 1) {
    if (gameReached(nearPoints, farPoints) || gameReached(farPoints, nearPoints)) {
      break;
    }
    const winner = sideForPlayer(match, match.points[index]!.winner);
    if (winner === 'near') {
      nearPoints += 1;
    } else {
      farPoints += 1;
    }
  }

  const nearWins = gameReached(nearPoints, farPoints);
  const farWins = gameReached(farPoints, nearPoints);
  const complete = nearWins || farWins;
  const winner: ShotPlayerSide | null = nearWins ? 'near' : farWins ? 'far' : null;
  const nearValue = POINT_VALUES[Math.min(nearPoints, 3)]!;
  const farValue = POINT_VALUES[Math.min(farPoints, 3)]!;

  return {
    near: nearValue,
    far: farValue,
    nearLabel: nearWins ? 'GAME' : formatPointValue(nearValue),
    farLabel: farWins ? 'GAME' : formatPointValue(farValue),
    winner,
    complete,
  };
}
