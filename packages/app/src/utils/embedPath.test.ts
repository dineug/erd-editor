import { matchRoutes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { isEmbedPath, isEmbedViewerUrl } from './embedPath';

const EMBED_PATHS = [
  '/embed',
  '/embed/',
  '/embed//',
  '/EMBED',
  '/Embed/',
  '/%65mbed',
  '/%45MBED',
];
const OTHER_PATHS = [
  '/embedx',
  '/embed/x',
  '/embed%2F',
  '/embed%',
  '/',
  '/live',
  '/embedded',
  '//embed',
  '/%2Fembed',
];

/**
 * The router's own verdict on the path, so an upgrade that moves its matching
 * fails here. Its warning of a malformed segment stays out of the output.
 */
function routerMatches(pathname: string): boolean {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  return matchRoutes([{ path: '/embed' }], { pathname }) !== null;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isEmbedPath', () => {
  it.each(EMBED_PATHS)('matches %s', pathname => {
    expect(isEmbedPath(pathname)).toBe(true);
    expect(routerMatches(pathname)).toBe(true);
  });

  it.each(OTHER_PATHS)('leaves %s to the other routes', pathname => {
    expect(isEmbedPath(pathname)).toBe(false);
    expect(routerMatches(pathname)).toBe(false);
  });
});

describe('isEmbedViewerUrl', () => {
  it.each([
    ['/embed', '?src=x'],
    ['/EMBED/', '?src=https%3A%2F%2Fexample.com%2Fa.erd.json&theme=light'],
    ['/embed', '?src=+'],
  ])('opens %s%s as the viewer', (pathname, search) => {
    expect(isEmbedViewerUrl({ pathname, search })).toBe(true);
  });

  it.each([
    ['/embed', ''],
    ['/embed', '?src='],
    ['/embed', '?src=&src=x'],
    ['/embed', '?theme=light'],
    ['/embed/x', '?src=x'],
    ['/', '?src=x'],
  ])('opens %s%s as no viewer', (pathname, search) => {
    expect(isEmbedViewerUrl({ pathname, search })).toBe(false);
  });
});
