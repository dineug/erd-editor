// @vitest-environment node
/// <reference types="node" />

import { describe, expect, it } from 'vite-plus/test';

import { readCookie, REFRESH_COOKIE, STATE_COOKIE } from '@/server/auth/cookie';

function withCookie(header: string) {
  return new Request('https://erd-editor.test/api/auth/token', {
    headers: { Cookie: header },
  });
}

describe('readCookie', () => {
  it('reads a cookie among others, around the space and tab of the header', () => {
    const request = withCookie(
      `theme=dark;\t${REFRESH_COOKIE}=v1.mine ; ${STATE_COOKIE}=v1.state`
    );

    expect(readCookie(request, REFRESH_COOKIE)).toBe('v1.mine');
    expect(readCookie(request, STATE_COOKIE)).toBe('v1.state');
    expect(readCookie(request, 'missing')).toBeNull();
  });

  it('takes the first of two cookies of one name, and none that is empty', () => {
    expect(
      readCookie(
        withCookie(`${REFRESH_COOKIE}=v1.first; ${REFRESH_COOKIE}=v1.second`),
        REFRESH_COOKIE
      )
    ).toBe('v1.first');
    expect(readCookie(withCookie(`${REFRESH_COOKIE}=`), REFRESH_COOKIE)).toBe(
      null
    );
  });

  // Another host of the site may set a name that only whitespace sets apart
  // from a __Host- one, which a browser sends first for its longer Path. A
  // header holds bytes, so these are the ones String.prototype.trim drops.
  it.each([
    ['a no-break space', '\u00a0'],
    ['a vertical tab', '\v'],
    ['a form feed', '\f'],
  ])('reads no cookie whose name %s pads', (_, pad) => {
    for (const name of [REFRESH_COOKIE, STATE_COOKIE]) {
      const request = withCookie(
        `${pad}${name}=v1.planted; ${name}${pad}=v1.planted; ${name}=v1.own`
      );

      expect(readCookie(request, name)).toBe('v1.own');
      expect(
        readCookie(withCookie(`${pad}${name}=v1.planted`), name)
      ).toBeNull();
    }
  });
});
