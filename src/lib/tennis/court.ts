export const HALF_LENGTH = 11.885 as const;
export const SINGLES_HALF_WIDTH = 4.115 as const;
export const DOUBLES_HALF_WIDTH = 5.485 as const;
export const SERVICE_LINE_DISTANCE = 6.4 as const;
export const BALL_RADIUS = 0.0335 as const;

export const NET_HEIGHT_CENTER = 0.914 as const;
export const NET_HEIGHT_POST = 1.07 as const;

export const COURT_LINE_WIDTH = 0.05 as const;
export const CENTER_MARK_LENGTH = 0.1 as const;
export const NET_TAPE_WIDTH = 0.05 as const;

export type CourtSide = 'near' | 'far';
export type CourtType = 'singles' | 'doubles';

export interface NetTapeVerticalRange {
  bottomY: number;
  topY: number;
}

export type Vec3 = readonly [number, number, number];

export interface IsInBoundsOptions {
  court?: CourtType;
}

/** Net height in metres at lateral position x (symmetric, clamped at posts). */
export function netHeightAt(x: number): number {
  const absX = Math.abs(x);
  if (absX >= DOUBLES_HALF_WIDTH) {
    return NET_HEIGHT_POST;
  }
  const t = absX / DOUBLES_HALF_WIDTH;
  return NET_HEIGHT_CENTER + t * (NET_HEIGHT_POST - NET_HEIGHT_CENTER);
}

/** Z centre of a baseline center mark, inset half the mark length from the baseline. */
export function centerMarkCenterZ(side: CourtSide): number {
  return side === 'near'
    ? -HALF_LENGTH + CENTER_MARK_LENGTH / 2
    : HALF_LENGTH - CENTER_MARK_LENGTH / 2;
}

/** Inclusive Z extent of a center mark running from the baseline into the court. */
export function centerMarkZRange(side: CourtSide): readonly [number, number] {
  return side === 'near'
    ? [-HALF_LENGTH, -HALF_LENGTH + CENTER_MARK_LENGTH]
    : [HALF_LENGTH - CENTER_MARK_LENGTH, HALF_LENGTH];
}

/** Lateral line width for center marks (X axis). */
export function centerMarkWidthX(): number {
  return COURT_LINE_WIDTH;
}

/** Vertical extent of net tape at lateral position x; top edge matches net height. */
export function netTapeVerticalRange(x: number): NetTapeVerticalRange {
  const topY = netHeightAt(x);
  return {
    topY,
    bottomY: topY - NET_TAPE_WIDTH,
  };
}

/** Whether a ground-plane point is inside the playable court (lines are in). */
export function isInBounds(
  x: number,
  z: number,
  options: IsInBoundsOptions = {},
): boolean {
  const court = options.court ?? 'singles';
  const halfWidth = court === 'doubles' ? DOUBLES_HALF_WIDTH : SINGLES_HALF_WIDTH;
  return Math.abs(x) <= halfWidth && Math.abs(z) <= HALF_LENGTH;
}
