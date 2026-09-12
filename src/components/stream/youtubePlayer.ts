export type InitializingYouTubePlayer = Partial<
  Pick<
    YT.Player,
    | 'destroy'
    | 'getCurrentTime'
    | 'getDuration'
    | 'getPlayerState'
    | 'pauseVideo'
    | 'playVideo'
    | 'seekTo'
  >
>;

type NumericPlayerMethod =
  | 'getCurrentTime'
  | 'getDuration'
  | 'getPlayerState';

type PlayerAction = 'destroy' | 'pauseVideo' | 'playVideo' | 'seekTo';

export function readYouTubePlayerNumber(
  player: InitializingYouTubePlayer | null,
  method: NumericPlayerMethod,
  fallback: number,
): number {
  const reader = player?.[method];
  if (typeof reader !== 'function') {
    return fallback;
  }

  const value = reader.call(player);
  return Number.isFinite(value) ? value : fallback;
}

export function callYouTubePlayer(
  player: InitializingYouTubePlayer | null,
  method: PlayerAction,
  ...args: [] | [seconds: number, allowSeekAhead?: boolean]
): void {
  if (!player) {
    return;
  }

  const action = player[method];
  if (typeof action === 'function') {
    (
      action as (
        this: InitializingYouTubePlayer,
        ...values: readonly unknown[]
      ) => void
    ).call(player, ...args);
  }
}
