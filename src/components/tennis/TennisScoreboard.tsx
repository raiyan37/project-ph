import type { CompiledPoint, TennisMatch } from '../../data/tennis/match';
import type { GameScore } from '../../lib/tennis/score';
import './tennis-shell.css';

export interface TennisScoreboardProps {
  match: TennisMatch;
  score: GameScore;
  currentPoint?: CompiledPoint;
}

export function TennisScoreboard({
  match,
  score,
  currentPoint,
}: TennisScoreboardProps) {
  const near = match.players.near;
  const far = match.players.far;
  const rally = currentPoint
    ? currentPoint.point.replayLabel
    : `${match.tournament} ${match.round}`;

  return (
    <div
      className="tennis-scoreboard"
      role="status"
      aria-live="polite"
      aria-label={`${near.name} ${score.nearLabel}, ${far.name} ${score.farLabel}. ${rally}.`}
    >
      <div className="tennis-scoreboard__player">
        <span className="tennis-scoreboard__name">{near.name}</span>
        <span className="tennis-scoreboard__meta">
          {near.countryCode} · near court
        </span>
      </div>
      <div className="tennis-scoreboard__points" aria-hidden="true">
        <span className={score.winner === 'near' ? 'is-game' : undefined}>
          {score.nearLabel}
        </span>
        <i className="tennis-scoreboard__rule" />
        <span className={score.winner === 'far' ? 'is-game' : undefined}>
          {score.farLabel}
        </span>
      </div>
      <div className="tennis-scoreboard__player tennis-scoreboard__player--far">
        <span className="tennis-scoreboard__name">{far.name}</span>
        <span className="tennis-scoreboard__meta">
          {far.countryCode} · far court
        </span>
      </div>
    </div>
  );
}
