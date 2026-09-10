import { describe, expect, it } from 'vitest';
import { TENNIS_MATCH } from '../../data/tennis/match';
import { formatPointValue, tennisGameScore } from './score';

describe('tennisGameScore', () => {
  it('starts at love-love before any point is complete', () => {
    const score = tennisGameScore(TENNIS_MATCH, 0);

    expect(score).toEqual({
      near: 0,
      far: 0,
      nearLabel: '0',
      farLabel: '0',
      winner: null,
      complete: false,
    });
  });

  it('advances 15-30-40 through the authored points', () => {
    expect(tennisGameScore(TENNIS_MATCH, 1)).toMatchObject({
      near: 0,
      far: 15,
      complete: false,
    });
    expect(tennisGameScore(TENNIS_MATCH, 2)).toMatchObject({
      near: 0,
      far: 30,
    });
    expect(tennisGameScore(TENNIS_MATCH, 3)).toMatchObject({
      near: 15,
      far: 30,
    });
    expect(tennisGameScore(TENNIS_MATCH, 4)).toMatchObject({
      near: 15,
      far: 40,
      complete: false,
      winner: null,
    });
  });

  it('awards game after four unanswered points', () => {
    const sweep = {
      ...TENNIS_MATCH,
      points: TENNIS_MATCH.points.map((point) => ({
        ...point,
        winner: 'jannik-sinner' as const,
      })),
    };
    const game = tennisGameScore(sweep, 4);

    expect(game).toMatchObject({
      far: 40,
      winner: 'far',
      complete: true,
    });
    expect(game.farLabel).toBe('GAME');
  });

  it('ignores extra completed points once the game is decided', () => {
    const sweep = {
      ...TENNIS_MATCH,
      points: TENNIS_MATCH.points.map((point) => ({
        ...point,
        winner: 'jannik-sinner' as const,
      })),
    };
    expect(tennisGameScore(sweep, 8).complete).toBe(true);
    expect(tennisGameScore(sweep, 8).winner).toBe('far');
  });
});

describe('formatPointValue', () => {
  it('renders tennis point labels', () => {
    expect(formatPointValue(0)).toBe('0');
    expect(formatPointValue(15)).toBe('15');
    expect(formatPointValue(30)).toBe('30');
    expect(formatPointValue(40)).toBe('40');
  });
});
