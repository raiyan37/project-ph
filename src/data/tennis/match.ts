import {
  solveTrajectory,
  type Shot,
  type ShotPlayerSide,
  type Trajectory,
} from '../../lib/tennis/trajectory';

export type TennisPlayerId = 'carlos-alcaraz' | 'jannik-sinner';
export type PointOutcome = 'winner' | 'net' | 'out';

export interface TennisPlayer {
  readonly id: TennisPlayerId;
  readonly name: string;
  readonly country: string;
  readonly countryCode: 'ESP' | 'ITA';
  readonly side: ShotPlayerSide;
}

export interface ScriptedShot extends Shot {
  /** Marks an intentional edit discontinuity before this contact. */
  readonly cutBefore?: boolean;
}

export interface ScriptedPoint {
  readonly id: string;
  readonly startT: number;
  readonly endT: number;
  readonly server: TennisPlayerId;
  readonly winner: TennisPlayerId;
  readonly outcome: PointOutcome;
  readonly replayLabel: string;
  readonly decisiveShotIndex: number;
  readonly shots: readonly ScriptedShot[];
  /** Marks an intentional source edit before the point begins. */
  readonly cutBefore?: boolean;
}

export interface MatchSource {
  readonly youtubeId: string;
  readonly title: string;
  readonly channel: string;
  readonly duration: number;
  readonly url: string;
  readonly timing: 'authored-approximate';
  readonly timingNote: string;
}

export interface TennisMatch {
  readonly id: string;
  readonly tournament: string;
  readonly year: number;
  readonly round: string;
  readonly players: Readonly<Record<ShotPlayerSide, TennisPlayer>>;
  readonly source: MatchSource;
  readonly points: readonly ScriptedPoint[];
}

export interface CompiledPoint {
  readonly point: ScriptedPoint;
  readonly trajectories: readonly Trajectory[];
}

export interface CompiledTennisMatch {
  readonly match: TennisMatch;
  readonly points: readonly CompiledPoint[];
}

export interface ReplayAtMediaTime {
  readonly point: ScriptedPoint;
  readonly compiledPoint: CompiledPoint;
  readonly shotIndex: number;
  readonly shot: ScriptedShot;
  readonly trajectory: Trajectory;
}

export const CARLOS_ALCARAZ: TennisPlayer = {
  id: 'carlos-alcaraz',
  name: 'Carlos Alcaraz',
  country: 'Spain',
  countryCode: 'ESP',
  side: 'near',
};

export const JANNIK_SINNER: TennisPlayer = {
  id: 'jannik-sinner',
  name: 'Jannik Sinner',
  country: 'Italy',
  countryCode: 'ITA',
  side: 'far',
};

export const TENNIS_PLAYERS: Readonly<
  Record<ShotPlayerSide, TennisPlayer>
> = {
  near: CARLOS_ALCARAZ,
  far: JANNIK_SINNER,
};

export const SCRIPTED_POINTS: readonly ScriptedPoint[] = [
  {
    id: 'point-01',
    startT: 13,
    endT: 18,
    server: 'carlos-alcaraz',
    winner: 'jannik-sinner',
    outcome: 'winner',
    replayLabel: 'Sinner baseline laser',
    decisiveShotIndex: 3,
    shots: [
      {
        t: 13,
        by: 'near',
        type: 'serve',
        from: [-0.55, 2.72, -11.75],
        to: [0.75, 5.65],
        speed: 50,
        spin: 'flat',
      },
      {
        t: 13.499,
        by: 'far',
        type: 'backhand',
        from: [1.154, 0.847, 11.063],
        to: [-1.5, -7.4],
        speed: 30,
        spin: 'topspin',
      },
      {
        t: 14.318,
        by: 'near',
        type: 'forehand',
        from: [-2.095, 0.553, -11.536],
        to: [2.5, 7.3],
        speed: 29,
        spin: 'topspin',
      },
      {
        t: 15.188,
        by: 'far',
        type: 'backhand',
        from: [3.453, 0.528, 11.207],
        to: [-2.55, -9.9],
        speed: 28,
        spin: 'flat',
      },
    ],
  },
  {
    id: 'point-02',
    startT: 36,
    endT: 41,
    server: 'jannik-sinner',
    winner: 'jannik-sinner',
    outcome: 'net',
    replayLabel: 'Alcaraz clips the tape',
    decisiveShotIndex: 3,
    shots: [
      {
        t: 36,
        by: 'far',
        type: 'serve',
        from: [0.6, 2.74, 11.75],
        to: [-0.65, -5.75],
        speed: 51,
        spin: 'slice',
      },
      {
        t: 36.494,
        by: 'near',
        type: 'forehand',
        from: [-1.045, 0.82, -11.279],
        to: [1.5, 7.3],
        speed: 29,
        spin: 'topspin',
      },
      {
        t: 37.34,
        by: 'far',
        type: 'backhand',
        from: [2.047, 0.561, 11.297],
        to: [-0.45, -6.8],
        speed: 26,
        spin: 'topspin',
      },
      {
        t: 38.266,
        by: 'near',
        type: 'forehand',
        from: [-0.997, 0.575, -10.767],
        to: [0.4, 8],
        speed: 26,
        spin: 'flat',
      },
    ],
  },
  {
    id: 'point-03',
    startT: 54,
    endT: 59,
    server: 'carlos-alcaraz',
    winner: 'carlos-alcaraz',
    outcome: 'out',
    replayLabel: 'Sinner misses by centimetres',
    decisiveShotIndex: 3,
    shots: [
      {
        t: 54,
        by: 'near',
        type: 'serve',
        from: [0.5, 2.73, -11.75],
        to: [-0.8, 5.7],
        speed: 49,
        spin: 'slice',
      },
      {
        t: 54.507,
        by: 'far',
        type: 'forehand',
        from: [-1.196, 0.796, 11.016],
        to: [1.6, -7.4],
        speed: 30,
        spin: 'topspin',
      },
      {
        t: 55.326,
        by: 'near',
        type: 'backhand',
        from: [2.227, 0.543, -11.531],
        to: [-2.2, 7.3],
        speed: 29,
        spin: 'topspin',
      },
      {
        t: 56.195,
        by: 'far',
        type: 'forehand',
        from: [-3.121, 0.525, 11.216],
        to: [4.175, -8.8],
        speed: 27,
        spin: 'flat',
      },
    ],
  },
  {
    id: 'point-04',
    startT: 83,
    endT: 89,
    server: 'jannik-sinner',
    winner: 'jannik-sinner',
    outcome: 'winner',
    replayLabel: 'Sinner closes with a volley',
    decisiveShotIndex: 4,
    shots: [
      {
        t: 83,
        by: 'far',
        type: 'serve',
        from: [-0.45, 2.76, 11.75],
        to: [0.75, -5.7],
        speed: 52,
        spin: 'flat',
      },
      {
        t: 83.486,
        by: 'near',
        type: 'backhand',
        from: [1.137, 0.878, -11.326],
        to: [-1.5, 7.4],
        speed: 30,
        spin: 'topspin',
      },
      {
        t: 84.315,
        by: 'far',
        type: 'forehand',
        from: [-2.082, 0.565, 11.534],
        to: [1.1, -6.8],
        speed: 26,
        spin: 'topspin',
      },
      {
        t: 85.256,
        by: 'near',
        type: 'backhand',
        from: [1.784, 0.587, -10.74],
        to: [-0.4, 9.2],
        speed: 22,
        spin: 'slice',
      },
      {
        t: 85.94,
        by: 'far',
        type: 'volley',
        from: [0.195, 0.901, 3.77],
        to: [2.8, -7.4],
        speed: 16,
        spin: 'slice',
      },
    ],
  },
];

export const TENNIS_MATCH: TennisMatch = {
  id: '2025-us-open-final-sinner-alcaraz',
  tournament: 'US Open',
  year: 2025,
  round: 'Final',
  players: TENNIS_PLAYERS,
  source: {
    youtubeId: 'DHo1mw7lj3s',
    title:
      'Jannik Sinner vs. Carlos Alcaraz Extended Highlights | 2025 US Open Final',
    channel: 'US Open Tennis Championships',
    duration: 704.121,
    url: 'https://www.youtube.com/watch?v=DHo1mw7lj3s',
    timing: 'authored-approximate',
    timingNote:
      '3D replay timing is authored to opening highlight segments and is not frame-accurate.',
  },
  points: SCRIPTED_POINTS,
};

const compilationCache = new WeakMap<TennisMatch, CompiledTennisMatch>();

export function compileTennisMatch(
  match: TennisMatch = TENNIS_MATCH,
): CompiledTennisMatch {
  const cached = compilationCache.get(match);
  if (cached) {
    return cached;
  }

  const compiled: CompiledTennisMatch = {
    match,
    points: match.points.map((point) => ({
      point,
      trajectories: point.shots.map((shot) => solveTrajectory(shot)),
    })),
  };
  compilationCache.set(match, compiled);
  return compiled;
}

let compiledTennisMatch: CompiledTennisMatch | undefined;

export function getCompiledTennisMatch(): CompiledTennisMatch {
  compiledTennisMatch ??= compileTennisMatch(TENNIS_MATCH);
  return compiledTennisMatch;
}

function pointIndexAtMediaTime(
  mediaTime: number,
  points: readonly CompiledPoint[],
): number {
  let low = 0;
  let high = points.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const point = points[middle]!.point;
    if (mediaTime < point.startT) {
      high = middle - 1;
    } else if (mediaTime >= point.endT) {
      low = middle + 1;
    } else {
      return middle;
    }
  }

  return -1;
}

function shotIndexAtMediaTime(
  mediaTime: number,
  shots: readonly ScriptedShot[],
): number {
  let low = 0;
  let high = shots.length - 1;

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (shots[middle]!.t <= mediaTime) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return low;
}

export function getReplayAtMediaTime(
  mediaTime: number,
  compiled?: CompiledTennisMatch,
): ReplayAtMediaTime | undefined {
  if (!Number.isFinite(mediaTime)) {
    throw new Error('Replay media time must be finite.');
  }

  const resolvedCompiled = compiled ?? getCompiledTennisMatch();
  const pointIndex = pointIndexAtMediaTime(
    mediaTime,
    resolvedCompiled.points,
  );
  if (pointIndex < 0) {
    return undefined;
  }

  const compiledPoint = resolvedCompiled.points[pointIndex]!;
  const shotIndex = shotIndexAtMediaTime(mediaTime, compiledPoint.point.shots);
  return {
    point: compiledPoint.point,
    compiledPoint,
    shotIndex,
    shot: compiledPoint.point.shots[shotIndex]!,
    trajectory: compiledPoint.trajectories[shotIndex]!,
  };
}
