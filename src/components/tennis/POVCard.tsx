import { useMemo, useState } from 'react';
import type { CompiledTennisMatch } from '../../data/tennis/match';
import {
  getActiveTrajectoryAtTime,
  type MatchTimeSource,
} from '../../lib/tennis/animation';
import { getPovSampleTime } from '../../lib/tennis/streamMedia';
import type { ShotPlayerSide } from '../../lib/tennis/trajectory';
import { CloudViewport } from '../../scene/pointcloud/CloudViewport';
import { usePovReconstruction } from '../../scene/pointcloud/PovReconstruction';
import { interpolatePovTrack } from '../../scene/pointcloud/tracks';
import './pov-card.css';

interface CurrentPOVStat {
  readonly label: string;
  readonly value: string;
}

function currentPOVStat(
  mediaTime: number,
  compiledMatch: CompiledTennisMatch,
  hasTrack: boolean,
): CurrentPOVStat {
  if (!hasTrack) {
    return { label: 'Court lock', value: 'Standby' };
  }

  const active = getActiveTrajectoryAtTime(mediaTime, compiledMatch);
  if (!active) {
    return { label: 'Court lock', value: 'Locked' };
  }

  const crossing = active.trajectory.netCrossing;
  if (crossing && active.sampleTime >= crossing.t) {
    const clearance = Math.round(crossing.surfaceClearance * 100);
    return {
      label: 'Net clearance',
      value: `${clearance > 0 ? '+' : ''}${clearance} cm`,
    };
  }

  return {
    label: 'Shot speed',
    value: `${Math.round(active.trajectory.shot.speed * 3.6)} km/h`,
  };
}

export interface POVCardProps {
  side: ShotPlayerSide;
  timeSource: MatchTimeSource;
  currentTime: number;
  compiledMatch: CompiledTennisMatch;
  className?: string;
}

export function POVCard({
  side,
  timeSource,
  currentTime,
  compiledMatch,
  className,
}: POVCardProps) {
  const [expanded, setExpanded] = useState(false);
  const reconstruction = usePovReconstruction();
  const player = compiledMatch.match.players[side];
  const pose = interpolatePovTrack(
    reconstruction?.manifest.tracks ?? [],
    getPovSampleTime(currentTime),
    side,
  );
  const stat = useMemo(
    () => currentPOVStat(currentTime, compiledMatch, !pose.standby),
    [compiledMatch, currentTime, pose.standby],
  );
  const viewportId = `pov-${side}-viewport`;
  const expandLabel = expanded ? 'Collapse' : 'Expand';

  return (
    <article
      className={[
        'pov-card',
        `pov-card--${side}`,
        expanded ? 'pov-card--expanded' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-labelledby={`pov-${side}-player`}
    >
      <div className="pov-card__signal-bar">
        <span className="pov-card__live">
          <span className="pov-card__live-dot" aria-hidden="true" />
          Live
        </span>
        <span className="pov-card__mode">Court Eye</span>
      </div>

      <div id={viewportId} className="pov-card__viewport-shell">
        <CloudViewport
          className="pov-card__viewport"
          timeSource={timeSource}
          side={side}
          index={side === 'near' ? 1 : 2}
        />

        <div className="pov-card__viewfinder" aria-hidden="true">
          <span className="pov-card__crosshair" />
          <span className="pov-card__lock">trk</span>
        </div>
        <span className="pov-card__measurement" aria-hidden="true">
          Eye 1.70 m&nbsp;&nbsp;·&nbsp;&nbsp;FOV 58°
        </span>
      </div>

      <div className="pov-card__identity">
        <div className="pov-card__player">
          <h2 id={`pov-${side}-player`}>{player.name}</h2>
          <p>
            {player.countryCode} · {player.country} · {side} court
          </p>
        </div>
        <dl className="pov-card__stat">
          <div>
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        </dl>
      </div>

      <button
        className="pov-card__expand"
        type="button"
        aria-controls={viewportId}
        aria-expanded={expanded}
        aria-label={`${expandLabel} ${player.name} court-eye view`}
        onClick={() => setExpanded((value) => !value)}
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.35"
          aria-hidden="true"
        >
          {expanded ? (
            <>
              <path d="M8 3v5H3M12 17v-5h5" />
              <path d="m3 8 5-5M17 12l-5 5" />
            </>
          ) : (
            <>
              <path d="M7 3H3v4M13 17h4v-4" />
              <path d="m3 7 4-4M17 13l-4 4" />
            </>
          )}
        </svg>
      </button>
    </article>
  );
}
