import { describe, expect, it, vi } from 'vitest';
import {
  callYouTubePlayer,
  readYouTubePlayerNumber,
} from './youtubePlayer';

describe('YouTube player initialization guards', () => {
  it('returns a fallback while numeric methods are not installed', () => {
    expect(readYouTubePlayerNumber({}, 'getDuration', 0)).toBe(0);
  });

  it('calls an available numeric method with the player as its receiver', () => {
    const player = {
      value: 42,
      getCurrentTime() {
        return this.value;
      },
    };

    expect(readYouTubePlayerNumber(player, 'getCurrentTime', 0)).toBe(42);
  });

  it('ignores playback actions until their methods are installed', () => {
    expect(() => callYouTubePlayer({}, 'playVideo')).not.toThrow();
  });

  it('forwards arguments to an available playback action', () => {
    const seekTo = vi.fn();

    callYouTubePlayer({ seekTo }, 'seekTo', 18, true);

    expect(seekTo).toHaveBeenCalledWith(18, true);
  });
});
