import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildApiUrl, CookieJar, redactUrl } from './http.mjs';

describe('buildApiUrl', () => {
  it('joins base URLs with the control-plane API prefix exactly once', () => {
    assert.equal(
      buildApiUrl('https://syncode.anggita.org/', '/api/health').toString(),
      'https://syncode.anggita.org/api/health',
    );
    assert.equal(
      buildApiUrl('https://syncode.anggita.org/api', 'problems').toString(),
      'https://syncode.anggita.org/api/problems',
    );
  });

  it('serializes query parameters while skipping empty values', () => {
    const url = buildApiUrl('https://syncode.anggita.org', 'problems', {
      limit: 20,
      search: 'two sum',
      tags: '',
      cursor: undefined,
    });

    assert.equal(
      url.toString(),
      'https://syncode.anggita.org/api/problems?limit=20&search=two+sum',
    );
  });
});

describe('CookieJar', () => {
  it('stores set-cookie headers and returns a compact cookie header', () => {
    const jar = new CookieJar();

    jar.store(['refreshToken=abc.def; Path=/auth; HttpOnly', 'theme=dark; Path=/']);

    assert.equal(jar.header(), 'refreshToken=abc.def; theme=dark');
  });
});

describe('redactUrl', () => {
  it('removes sensitive query values from logged URLs', () => {
    assert.equal(
      redactUrl('https://syncode.anggita.org/api/rooms/123?token=secret&cursor=abc'),
      'https://syncode.anggita.org/api/rooms/123?token=%5Bredacted%5D&cursor=abc',
    );
  });
});
