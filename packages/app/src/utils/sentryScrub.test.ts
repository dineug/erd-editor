import type { BrowserOptions, ErrorEvent } from '@sentry/react';
import { describe, expect, it } from 'vite-plus/test';

import {
  filterBreadcrumb,
  scrubEvent,
  scrubUrl,
  sentryPrivacyOptions,
  shouldCreateSpanForRequest,
} from '@/utils/sentryScrub';

type TransactionEvent = Parameters<
  NonNullable<BrowserOptions['beforeSendTransaction']>
>[0];

describe('scrubUrl', () => {
  it.each([
    [
      'https://www.googleapis.com/drive/v3/files/abc123?fields=id,name&supportsAllDrives=true',
      'https://www.googleapis.com/drive/v3/files/[id]',
    ],
    [
      'https://www.googleapis.com/upload/drive/v3/files/abc123?uploadType=media',
      'https://www.googleapis.com/upload/drive/v3/files/[id]',
    ],
    [
      'https://www.googleapis.com/drive/v3/files?q=trashed%3Dfalse&pageToken=x',
      'https://www.googleapis.com/drive/v3/files',
    ],
    [
      'https://erd-editor.io/gdrive?state=%7B%22ids%22%3A%5B%22abc%22%5D%7D&file=abc',
      'https://erd-editor.io/gdrive',
    ],
    ['/gdrive?file=abc#top', '/gdrive'],
    ['/gdrive', '/gdrive'],
    [
      'http://localhost:5175/api/auth/callback?code=secret&state=s',
      'http://localhost:5175/api/auth/callback',
    ],
    [
      'https://accounts.google.com/o/oauth2/v2/auth?login_hint=123',
      'https://accounts.google.com/o/oauth2/v2/auth',
    ],
  ])('scrubs %s', (url, expected) => {
    expect(scrubUrl(url)).toBe(expected);
  });

  it.each([
    'https://erd-editor.io/?schema=local-id',
    '/live/#room,secret',
    'https://erd-editor.io/gdrivers?x=1',
    'https://example.com/files/abc?x=1',
    'https://notgoogleapis.com.evil.test/files/abc?x=1',
  ])('leaves %s as it is', url => {
    expect(scrubUrl(url)).toBe(url);
  });
});

describe('shouldCreateSpanForRequest', () => {
  it.each([
    ['https://www.googleapis.com/drive/v3/files', false],
    ['https://accounts.google.com/gsi/client', false],
    ['/api/auth/token', false],
    ['http://localhost:5175/api/auth/logout', false],
    ['/static/js/bundle.1234abcd.js', true],
    ['https://sentry.io/api/1/envelope/', true],
  ])('%s → %s', (url, expected) => {
    expect(shouldCreateSpanForRequest(url)).toBe(expected);
  });
});

describe('scrubEvent', () => {
  it('scrubs the request, its referrer, the transaction, spans and breadcrumbs', () => {
    const event: ErrorEvent = {
      type: undefined,
      request: {
        url: 'https://erd-editor.io/gdrive?file=abc',
        query_string: 'file=abc',
        headers: {
          Referer: 'https://erd-editor.io/gdrive?state=%7B%7D',
          'User-Agent': 'agent',
        },
      },
      transaction: '/gdrive?file=abc',
      spans: [
        {
          span_id: '1',
          trace_id: '2',
          start_timestamp: 0,
          description:
            'GET https://www.googleapis.com/drive/v3/files/abc?fields=id',
          data: {
            url: 'https://www.googleapis.com/drive/v3/files/abc?fields=id',
            'http.url':
              'https://www.googleapis.com/upload/drive/v3/files/abc?uploadType=media',
            'http.method': 'GET',
          },
        },
      ],
      breadcrumbs: [
        {
          category: 'navigation',
          data: { from: '/gdrive?file=a', to: '/gdrive?file=b' },
        },
        { category: 'console', message: 'hello' },
      ],
    };

    const scrubbed = scrubEvent(event);

    expect(scrubbed.request).toEqual({
      url: 'https://erd-editor.io/gdrive',
      headers: {
        Referer: 'https://erd-editor.io/gdrive',
        'User-Agent': 'agent',
      },
    });
    expect(scrubbed.transaction).toBe('/gdrive');
    expect(scrubbed.spans?.[0].description).toBe(
      'GET https://www.googleapis.com/drive/v3/files/[id]'
    );
    expect(scrubbed.spans?.[0].data).toEqual({
      url: 'https://www.googleapis.com/drive/v3/files/[id]',
      'http.url': 'https://www.googleapis.com/upload/drive/v3/files/[id]',
      'http.method': 'GET',
    });
    expect(scrubbed.breadcrumbs).toEqual([
      { category: 'navigation', data: { from: '/gdrive', to: '/gdrive' } },
      { category: 'console', message: 'hello' },
    ]);
  });

  it('keeps the query of a URL it leaves alone', () => {
    const event: ErrorEvent = {
      type: undefined,
      request: {
        url: 'https://erd-editor.io/?schema=local',
        query_string: 'schema=local',
        headers: { referer: 'https://erd-editor.io/gdrive?file=abc' },
      },
    };

    expect(scrubEvent(event).request).toEqual({
      url: 'https://erd-editor.io/?schema=local',
      query_string: 'schema=local',
      headers: { referer: 'https://erd-editor.io/gdrive' },
    });
  });

  it('scrubs a span description that is a URL alone', () => {
    const event: TransactionEvent = {
      type: 'transaction',
      spans: [
        {
          span_id: '1',
          trace_id: '2',
          start_timestamp: 0,
          description: '/gdrive?state=x',
          data: {},
        },
      ],
    };

    expect(scrubEvent(event).spans?.[0].description).toBe('/gdrive');
  });

  it('takes an event without a request, spans or breadcrumbs', () => {
    const event: ErrorEvent = { type: undefined, message: 'boom' };
    expect(scrubEvent(event)).toEqual({ type: undefined, message: 'boom' });
  });
});

describe('filterBreadcrumb', () => {
  it('drops ui breadcrumbs on /gdrive, which can name a file', () => {
    expect(
      filterBreadcrumb(
        {
          category: 'ui.click',
          message: 'button[aria-label="Actions for a.erd"]',
        },
        '/gdrive'
      )
    ).toBeNull();
    expect(
      filterBreadcrumb({ category: 'ui.input', message: 'x' }, '/gdrive/')
    ).toBeNull();
  });

  it('keeps ui breadcrumbs elsewhere', () => {
    const breadcrumb = { category: 'ui.click', message: 'button' };
    expect(filterBreadcrumb(breadcrumb, '/')).toBe(breadcrumb);
    expect(filterBreadcrumb(breadcrumb, '/gdrivers')).toBe(breadcrumb);
  });

  it.each(['fetch', 'xhr'])(
    'drops %s breadcrumbs to Google or the relay on any page',
    category => {
      for (const url of [
        'https://www.googleapis.com/drive/v3/files/abc?fields=id',
        '/api/auth/token',
      ]) {
        expect(filterBreadcrumb({ category, data: { url } }, '/')).toBeNull();
      }
    }
  );

  it('keeps and scrubs other fetch breadcrumbs', () => {
    expect(
      filterBreadcrumb(
        { category: 'fetch', data: { url: '/gdrive?file=abc', method: 'GET' } },
        '/gdrive'
      )
    ).toEqual({ category: 'fetch', data: { url: '/gdrive', method: 'GET' } });
    expect(
      filterBreadcrumb({ category: 'fetch', data: { method: 'GET' } }, '/')
    ).toEqual({ category: 'fetch', data: { method: 'GET' } });
  });

  it('drops a navigation with a query on /gdrive and keeps one without', () => {
    expect(
      filterBreadcrumb(
        {
          category: 'navigation',
          data: { from: '/gdrive', to: '/gdrive?file=a' },
        },
        '/gdrive'
      )
    ).toBeNull();
    expect(
      filterBreadcrumb(
        {
          category: 'navigation',
          data: { from: '/gdrive?state=x', to: '/gdrive' },
        },
        '/gdrive'
      )
    ).toBeNull();
    expect(
      filterBreadcrumb(
        { category: 'navigation', data: { from: '/', to: '/gdrive' } },
        '/gdrive'
      )
    ).toEqual({ category: 'navigation', data: { from: '/', to: '/gdrive' } });
  });

  it('scrubs a navigation elsewhere and takes one without a category', () => {
    expect(
      filterBreadcrumb(
        { category: 'navigation', data: { from: '/gdrive?file=a', to: '/' } },
        '/'
      )
    ).toEqual({ category: 'navigation', data: { from: '/gdrive', to: '/' } });
    expect(filterBreadcrumb({ message: 'plain' }, '/gdrive')).toEqual({
      message: 'plain',
    });
  });
});

describe('sentryPrivacyOptions', () => {
  it('reads the path when a breadcrumb is recorded and scrubs both event kinds', () => {
    let pathname = '/';
    const options = sentryPrivacyOptions(() => pathname);
    const click = { category: 'ui.click', message: 'x' };

    expect(options.beforeBreadcrumb(click)).toBe(click);
    pathname = '/gdrive';
    expect(options.beforeBreadcrumb(click)).toBeNull();

    expect(
      options.beforeSend({
        type: undefined,
        request: { url: '/gdrive?file=a' },
      }).request?.url
    ).toBe('/gdrive');
    expect(
      options.beforeSendTransaction({
        type: 'transaction',
        transaction: '/gdrive?state=x',
      }).transaction
    ).toBe('/gdrive');
  });
});
