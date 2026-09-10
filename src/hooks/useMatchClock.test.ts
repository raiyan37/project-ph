import { describe, expect, it } from 'vitest';
import { InterpolatedMediaClock } from './useMatchClock';

describe('InterpolatedMediaClock', () => {
  it('advances time while playing', () => {
    const clock = new InterpolatedMediaClock({ time: 10, duration: 120, playing: true });
    clock.reanchor(10, 1000);

    expect(clock.getTime(1500)).toBeCloseTo(10.5, 5);
  });

  it('holds time while paused', () => {
    const clock = new InterpolatedMediaClock({ time: 10, duration: 120, playing: false });
    clock.reanchor(10, 1000);

    expect(clock.getTime(1500)).toBeCloseTo(10, 5);
  });

  it('clamps time to [0, duration]', () => {
    const clock = new InterpolatedMediaClock({ time: 99, duration: 100, playing: true });
    clock.reanchor(99, 1000);

    expect(clock.getTime(3000)).toBe(100);
    expect(clock.getTime(0)).toBe(99);
  });

  it('does not change playing state when re-anchoring a negative authoritative sample', () => {
    const clock = new InterpolatedMediaClock({ time: 10, duration: 120, playing: true });
    clock.reanchor(-5, 1000);

    expect(clock.getTime(1000)).toBe(0);
    expect(clock.getTime(2000)).toBeCloseTo(1, 5);
  });

  it('clamps negative authoritative samples to zero while paused', () => {
    const clock = new InterpolatedMediaClock({ time: 10, duration: 120, playing: false });
    clock.reanchor(-5, 1000);

    expect(clock.getTime(1000)).toBe(0);
    expect(clock.getTime(2000)).toBe(0);
  });

  it('does not change playing state when re-anchoring beyond duration', () => {
    const clock = new InterpolatedMediaClock({ time: 10, duration: 100, playing: true });
    clock.reanchor(150, 1000);

    expect(clock.getTime(1000)).toBe(100);
    expect(clock.getTime(2000)).toBe(100);
  });

  it('applies playing transitions only through setPlaying', () => {
    const clock = new InterpolatedMediaClock({ time: 5, duration: 120, playing: true });
    clock.reanchor(5, 1000);

    clock.setPlaying(false);
    expect(clock.getTime(2000)).toBe(5);

    clock.setPlaying(true);
    clock.reanchor(5, 2000);
    expect(clock.getTime(3000)).toBeCloseTo(6, 5);
  });

  it('re-anchors after an authoritative sample corrects drift', () => {
    const clock = new InterpolatedMediaClock({ time: 10, duration: 120, playing: true });
    clock.reanchor(10, 1000);

    expect(clock.getTime(1500)).toBeCloseTo(10.5, 5);

    clock.reanchor(12, 1500);

    expect(clock.getTime(2000)).toBeCloseTo(12.5, 5);
  });
});
