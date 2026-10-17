import { describe, expect, it } from 'vitest';
import {
  compareHlc,
  createHlcClock,
  formatHlc,
  hlcProblem,
  hlcWins,
  isHlc,
  MAX_FUTURE_SKEW_MS,
} from './hlc.js';

describe('hlc', () => {
  it('validates the wire format', () => {
    expect(isHlc('1760716800000-0003-pixel6a')).toBe(true);
    expect(isHlc('1760716800000-0003-1b4e28ba-2fa1-11d2-883f-0016d3cca427')).toBe(true);
    for (const bad of [
      '',
      '176071680000-0003-a',
      '1760716800000-03-a',
      '1760716800000-0003-',
      'x',
    ]) {
      expect(isHlc(bad)).toBe(false);
    }
  });

  it('orders by time, then counter, then device id', () => {
    const a = formatHlc(1760716800000, 0, 'b');
    const b = formatHlc(1760716800000, 1, 'a');
    const c = formatHlc(1760716800001, 0, 'a');
    expect([c, b, a].sort(compareHlc)).toEqual([a, b, c]);
    expect(compareHlc(formatHlc(5, 0, 'a'), formatHlc(5, 0, 'b'))).toBe(-1);
  });

  it('applies only strictly newer stamps', () => {
    const s = formatHlc(1000, 0, 'a');
    expect(hlcWins(s, null)).toBe(true);
    expect(hlcWins(s, s)).toBe(false);
    expect(hlcWins(formatHlc(1000, 1, 'a'), s)).toBe(true);
    expect(hlcWins(formatHlc(999, 9, 'z'), s)).toBe(false);
  });

  it('rejects stamps too far in the future', () => {
    const now = 1760716800000;
    expect(hlcProblem(formatHlc(now + MAX_FUTURE_SKEW_MS - 1, 0, 'a'), now)).toBeNull();
    expect(hlcProblem(formatHlc(now + MAX_FUTURE_SKEW_MS + 1, 0, 'a'), now)).toMatch(
      /future/
    );
    expect(hlcProblem('nope', now)).toMatch(/Invalid/);
  });

  it('clock is monotonic even when the wall clock goes backwards', () => {
    let t = 1000;
    const clock = createHlcClock('dev', () => t);
    const a = clock.tick();
    t = 900;
    const b = clock.tick();
    t = 1001;
    const c = clock.tick();
    expect(a < b && b < c).toBe(true);
    clock.receive(formatHlc(5000, 7, 'other'));
    t = 1002;
    expect(clock.tick()).toBe(formatHlc(5000, 8, 'dev'));
  });
});
