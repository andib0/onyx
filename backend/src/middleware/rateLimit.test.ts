import { describe, expect, it } from 'vitest';
import { clientKey } from './rateLimit.js';

describe('clientKey (audit F7)', () => {
  it('keeps IPv4 and unwraps IPv4-mapped IPv6', () => {
    expect(clientKey('203.0.113.7')).toBe('203.0.113.7');
    expect(clientKey('::ffff:203.0.113.7')).toBe('203.0.113.7');
  });

  it('collapses IPv6 to the /64, compressed or not', () => {
    const k = '2001:db8:aa:bb::/64';
    expect(clientKey('2001:db8:aa:bb::1')).toBe(k);
    expect(clientKey('2001:0db8:00aa:00bb:ffff:1:2:3')).toBe(k);
    expect(clientKey('2001:db8:aa:bb:1::')).toBe(k);
    expect(clientKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(clientKey('::1')).toBe('0:0:0:0::/64');
  });

  it('never returns an empty key', () => {
    expect(clientKey(undefined)).toBe('unknown');
    expect(clientKey('')).toBe('unknown');
  });
});
