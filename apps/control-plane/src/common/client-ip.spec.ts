import { describe, expect, it } from 'vitest';
import { getClientIpFromRequest } from './client-ip.js';

describe('getClientIpFromRequest', () => {
  it('uses the Express trusted proxy client IP when available', () => {
    expect(
      getClientIpFromRequest({
        headers: {
          'x-real-ip': '198.51.100.10',
          'x-forwarded-for': '198.51.100.11, 10.0.0.8',
        },
        ip: '203.0.113.10',
        ips: ['203.0.113.20', '10.0.0.8'],
      }),
    ).toBe('203.0.113.20');
  });

  it('falls back to the nginx real IP header', () => {
    expect(
      getClientIpFromRequest({
        headers: {
          'x-real-ip': '198.51.100.10',
          'x-forwarded-for': '198.51.100.11, 10.0.0.8',
        },
      }),
    ).toBe('198.51.100.10');
  });

  it('uses the leftmost forwarded-for address when no real IP header exists', () => {
    expect(
      getClientIpFromRequest({
        headers: {
          'x-forwarded-for': '198.51.100.11, 10.0.0.8',
        },
      }),
    ).toBe('198.51.100.11');
  });

  it('falls back to the socket remote address', () => {
    expect(
      getClientIpFromRequest({
        socket: {
          remoteAddress: '10.0.0.8',
        },
      }),
    ).toBe('10.0.0.8');
  });
});
