import type {
  BrowserOptions,
  browserTracingIntegration,
  ErrorEvent,
} from '@sentry/react';
import { describe, expect, it } from 'vite-plus/test';

import {
  filterBreadcrumb,
  scrubEvent,
  scrubSpan,
  scrubUrl,
  sentryPrivacyOptions,
  shouldCreateSpanForRequest,
} from '@/utils/sentryScrub';

type TransactionEvent = Parameters<
  NonNullable<BrowserOptions['beforeSendTransaction']>
>[0];
type SpanJson = Parameters<NonNullable<BrowserOptions['beforeSendSpan']>>[0];
type TracingOptions = NonNullable<
  Parameters<typeof browserTracingIntegration>[0]
>;

const EMBED_SRC = '?src=https%3A%2F%2Fx.test%2Fa.erd.json';

/** The INP span Sentry sends alone, named after the element as htmlTreeAsString writes it. */
function interactionSpan(transaction: string): SpanJson {
  return {
    span_id: '1',
    trace_id: '2',
    start_timestamp: 0,
    op: 'ui.interaction.click',
    description:
      'div.row > button.trigger[aria-label="Actions for secret plan.erd"]',
    data: { transaction, 'sentry.op': 'ui.interaction.click' },
  };
}

/** A pageload as the SDK sends it: its root span's data in contexts.trace. */
function pageload(url: string, transaction: string): TransactionEvent {
  return {
    type: 'transaction',
    transaction,
    contexts: {
      trace: {
        trace_id: '2',
        span_id: '1',
        data: {
          'url.full': url,
          'url.path': transaction,
          'lcp.element': 'body > span[title="ada@example.com"]',
          'lcp.id': 'email',
          'lcp.url': 'https://lh3.googleusercontent.com/a/photo',
          'cls.source.1': 'li[aria-label="Actions for secret plan.erd"]',
          'sentry.op': 'pageload',
        },
      },
    },
  };
}

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
    ['https://erd-editor.io/GDrive?file=abc', 'https://erd-editor.io/GDrive'],
    ['/%67drive?state=x', '/%67drive'],
    [
      'http://localhost:5175/api/auth/callback?code=secret&state=s',
      'http://localhost:5175/api/auth/callback',
    ],
    [
      'https://accounts.google.com/o/oauth2/v2/auth?login_hint=123',
      'https://accounts.google.com/o/oauth2/v2/auth',
    ],
    ['/live/#room,secret', '/live/'],
    ['/live?x=1#k', '/live'],
    ['https://erd-editor.io/live/#room,secret', 'https://erd-editor.io/live/'],
    ['/embed?src=https%3A%2F%2Fx%2Fa.erd.json#y', '/embed'],
    [`https://erd-editor.io/embed${EMBED_SRC}`, 'https://erd-editor.io/embed'],
    [
      `https://erd-editor.io/embed/${EMBED_SRC}`,
      'https://erd-editor.io/embed/',
    ],
    [`/Embed${EMBED_SRC}`, '/Embed'],
    [`/%65mbed${EMBED_SRC}`, '/%65mbed'],
    ['/%65mbed?src=a%ZZ', '/%65mbed'],
    ['/embed/%ZZ?src=x', '/embed/%ZZ'],
    ['/%67drive?state=a%ZZ', '/%67drive'],
  ])('scrubs %s', (url, expected) => {
    expect(scrubUrl(url)).toBe(expected);
  });

  it.each([
    'https://erd-editor.io/?schema=local-id',
    'https://erd-editor.io/gdrivers?x=1',
    'https://erd-editor.io/embedded?x=1',
    '/lives?x=1',
    'https://example.com/files/abc?x=1',
    'https://notgoogleapis.com.evil.test/files/abc?x=1',
  ])('leaves %s as it is', url => {
    expect(scrubUrl(url)).toBe(url);
  });
});

describe('shouldCreateSpanForRequest', () => {
  const requests: [string, boolean][] = [
    ['https://www.googleapis.com/drive/v3/files', false],
    ['https://accounts.google.com/gsi/client', false],
    ['/api/auth/token', false],
    ['http://localhost:5175/api/auth/logout', false],
    ['/static/js/bundle.1234abcd.js', true],
    ['https://sentry.io/api/1/envelope/', true],
    ['https://raw.githubusercontent.com/o/r/main/a.erd.json', true],
  ];

  it.each(['/', '/live/', '/embedded'])(
    'on %s, traces every request but those to Google and the relay',
    pathname => {
      for (const [url, expected] of requests) {
        expect(shouldCreateSpanForRequest(url, pathname)).toBe(expected);
      }
    }
  );

  it.each(['/embed', '/Embed', '/%65mbed', '/embed/'])(
    'on %s, traces no request',
    pathname => {
      for (const [url] of requests) {
        expect(shouldCreateSpanForRequest(url, pathname)).toBe(false);
      }
    }
  );

  it('cannot be handed to Sentry without the path', () => {
    const options: TracingOptions = {
      // @ts-expect-error Sentry calls it with the URL alone
      shouldCreateSpanForRequest,
    };
    expect(options.shouldCreateSpanForRequest).toBe(shouldCreateSpanForRequest);
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

  it('scrubs the root span data of a transaction and drops what its web vitals name on /gdrive', () => {
    const event = pageload(
      'https://erd-editor.io/gdrive?state=%7B%22ids%22%3A%5B%22abc%22%5D%7D&file=abc',
      '/gdrive'
    );

    expect(scrubEvent(event).contexts?.trace?.data).toEqual({
      'url.full': 'https://erd-editor.io/gdrive',
      'url.path': '/gdrive',
      'sentry.op': 'pageload',
    });
  });

  it('keeps the web vitals of a transaction elsewhere', () => {
    const event = pageload('https://erd-editor.io/?schema=local', '/');

    expect(scrubEvent(event).contexts?.trace?.data).toMatchObject({
      'url.full': 'https://erd-editor.io/?schema=local',
      'lcp.element': 'body > span[title="ada@example.com"]',
      'cls.source.1': 'li[aria-label="Actions for secret plan.erd"]',
    });
  });

  it('drops the query and fragment of a span to a private URL, and keeps others', () => {
    const event: TransactionEvent = {
      type: 'transaction',
      spans: [
        {
          span_id: '1',
          trace_id: '2',
          start_timestamp: 0,
          data: {
            'url.full': 'https://erd-editor.io/gdrive?file=abc#top',
            'http.query': '?file=abc',
            'http.fragment': '#top',
          },
        },
        {
          span_id: '3',
          trace_id: '2',
          start_timestamp: 0,
          data: {
            'url.full': 'https://erd-editor.io/?schema=local',
            'http.query': '?schema=local',
          },
        },
      ],
    };

    const [drive, local] = scrubEvent(event).spans!;
    expect(drive.data).toEqual({ 'url.full': 'https://erd-editor.io/gdrive' });
    expect(local.data).toEqual({
      'url.full': 'https://erd-editor.io/?schema=local',
      'http.query': '?schema=local',
    });
  });

  it('scrubs the files of exception frames on a private page and keeps the bundle files', () => {
    const embed = `https://erd-editor.io/embed${EMBED_SRC}#k`;
    const live = 'https://erd-editor.io/live/#room,secret';
    const bundle = 'https://erd-editor.io/static/js/x.1234abcd.js';
    const event: ErrorEvent = {
      type: undefined,
      exception: {
        values: [
          {
            type: 'Error',
            stacktrace: {
              frames: [
                { filename: embed, abs_path: embed, lineno: 1 },
                { filename: live, abs_path: live },
                { filename: '/gdrive?file=x' },
                { filename: bundle, abs_path: bundle, lineno: 2 },
                { function: '?' },
              ],
            },
          },
          { type: 'TypeError', value: 'boom' },
        ],
      },
    };

    expect(scrubEvent(event).exception?.values).toEqual([
      {
        type: 'Error',
        stacktrace: {
          frames: [
            {
              filename: 'https://erd-editor.io/embed',
              abs_path: 'https://erd-editor.io/embed',
              lineno: 1,
            },
            {
              filename: 'https://erd-editor.io/live/',
              abs_path: 'https://erd-editor.io/live/',
            },
            { filename: '/gdrive' },
            { filename: bundle, abs_path: bundle, lineno: 2 },
            { function: '?' },
          ],
        },
      },
      { type: 'TypeError', value: 'boom' },
    ]);
  });

  it('scrubs the request and the root span of an /embed or /live page', () => {
    const embed = scrubEvent(
      pageload(`https://erd-editor.io/embed${EMBED_SRC}#k`, '/embed')
    );
    expect(embed.contexts?.trace?.data?.['url.full']).toBe(
      'https://erd-editor.io/embed'
    );

    const event: ErrorEvent = {
      type: undefined,
      request: {
        url: 'https://erd-editor.io/live/#room,secret',
        headers: { Referer: `https://erd-editor.io/embed${EMBED_SRC}` },
      },
      breadcrumbs: [
        {
          category: 'navigation',
          data: { from: '/live/#room,secret', to: '/' },
        },
      ],
    };
    expect(scrubEvent(event)).toMatchObject({
      request: {
        url: 'https://erd-editor.io/live/',
        headers: { Referer: 'https://erd-editor.io/embed' },
      },
      breadcrumbs: [{ data: { from: '/live/', to: '/' } }],
    });
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

  it('drops them on /gdrive however the router was asked for it', () => {
    for (const pathname of ['/GDrive', '/%67drive']) {
      expect(
        filterBreadcrumb({ category: 'ui.click', message: 'x' }, pathname)
      ).toBeNull();
    }
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

  it.each(['fetch', 'xhr'])('drops every %s breadcrumb on /embed', category => {
    for (const pathname of ['/embed', '/Embed', '/%65mbed', '/embed/']) {
      for (const data of [
        { url: 'https://raw.githubusercontent.com/o/r/main/a.erd.json' },
        { url: '/static/js/x.1234abcd.js' },
        { method: 'GET' },
      ]) {
        expect(filterBreadcrumb({ category, data }, pathname)).toBeNull();
      }
    }
  });

  it('keeps the other breadcrumbs on /embed', () => {
    const click = { category: 'ui.click', message: 'button' };
    expect(filterBreadcrumb(click, '/embed')).toBe(click);
    expect(
      filterBreadcrumb(
        { category: 'navigation', data: { from: `/embed${EMBED_SRC}` } },
        '/embed'
      )
    ).toEqual({ category: 'navigation', data: { from: '/embed' } });
  });

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

describe('scrubSpan', () => {
  it('names no element of an interaction on /gdrive', () => {
    const span = scrubSpan(interactionSpan('/gdrive'), true);

    expect(span.description).toBe('[Filtered]');
    expect(span.op).toBe('ui.interaction.click');
  });

  it('keeps the element of an interaction elsewhere', () => {
    expect(scrubSpan(interactionSpan('/'), false).description).toBe(
      'div.row > button.trigger[aria-label="Actions for secret plan.erd"]'
    );
  });

  it('scrubs the URLs of any span and drops element names on /gdrive', () => {
    const span: SpanJson = {
      span_id: '1',
      trace_id: '2',
      start_timestamp: 0,
      op: 'navigation',
      description: '/gdrive?file=abc',
      data: {
        'url.full': 'https://erd-editor.io/gdrive?file=abc',
        'lcp.element': 'span[title="ada@example.com"]',
      },
    };

    expect(scrubSpan(span, true)).toMatchObject({
      description: '/gdrive',
      data: { 'url.full': 'https://erd-editor.io/gdrive' },
    });
    expect(span.data).not.toHaveProperty('lcp.element');
  });

  it('takes a span without a description or data', () => {
    const span = {
      span_id: '1',
      trace_id: '2',
      start_timestamp: 0,
    } as SpanJson;
    expect(scrubSpan(span, true)).toBe(span);
  });
});

describe('sentryPrivacyOptions', () => {
  it('filters an interaction its route or the page puts on /gdrive, from then on', () => {
    let pathname = '/';
    const options = sentryPrivacyOptions(() => pathname);

    expect(
      options.init.beforeSendSpan(interactionSpan('/')).description
    ).toMatch(/^div\.row/);
    expect(
      options.init.beforeSendSpan(interactionSpan('/gdrive')).description
    ).toBe('[Filtered]');

    // Back left /gdrive before the tab was hidden and the span went.
    const later = sentryPrivacyOptions(() => pathname);
    pathname = '/gdrive';
    later.init.beforeBreadcrumb({ category: 'fetch', data: { url: '/x' } });
    pathname = '/';
    expect(later.init.beforeSendSpan(interactionSpan('/')).description).toBe(
      '[Filtered]'
    );
  });

  it('marks the page from a /gdrive transaction too', () => {
    const options = sentryPrivacyOptions(() => '/');
    options.init.beforeSendTransaction(
      pageload('https://erd-editor.io/gdrive', '/gdrive')
    );
    expect(options.init.beforeSend({ type: undefined }).type).toBeUndefined();
    expect(options.init.beforeSendSpan(interactionSpan('/')).description).toBe(
      '[Filtered]'
    );
  });

  it('reads the path when a breadcrumb is recorded and scrubs both event kinds', () => {
    let pathname = '/';
    const options = sentryPrivacyOptions(() => pathname);
    const click = { category: 'ui.click', message: 'x' };

    expect(options.init.beforeBreadcrumb(click)).toBe(click);
    pathname = '/gdrive';
    expect(options.init.beforeBreadcrumb(click)).toBeNull();

    expect(
      options.init.beforeSend({
        type: undefined,
        request: { url: '/gdrive?file=a' },
      }).request?.url
    ).toBe('/gdrive');
    expect(
      options.init.beforeSendTransaction({
        type: 'transaction',
        transaction: '/gdrive?state=x',
      }).transaction
    ).toBe('/gdrive');
  });

  it('reads the path for each request in its tracing option, as Sentry takes it', () => {
    let pathname = '/';
    const { tracing } = sentryPrivacyOptions(() => pathname);
    const accepted: TracingOptions = tracing;
    const url = 'https://raw.githubusercontent.com/o/r/main/a.erd.json';

    expect(accepted).toBe(tracing);
    expect(tracing.shouldCreateSpanForRequest(url)).toBe(true);
    pathname = '/embed';
    expect(tracing.shouldCreateSpanForRequest(url)).toBe(false);
    pathname = '/live/';
    expect(tracing.shouldCreateSpanForRequest(url)).toBe(true);
  });

  it.each(['fetch', 'xhr'])(
    'drops the %s breadcrumb of a request started on /embed that ends after the page left',
    category => {
      let pathname = '/embed';
      const options = sentryPrivacyOptions(() => pathname);
      const url = 'https://raw.githubusercontent.com/o/r/main/a.erd.json';

      // Sentry asks as the request starts and records it as it ends.
      expect(options.tracing.shouldCreateSpanForRequest(url)).toBe(false);
      pathname = '/';
      expect(options.tracing.shouldCreateSpanForRequest(url)).toBe(true);
      expect(
        options.init.beforeBreadcrumb({
          category,
          level: 'error',
          data: { url, method: 'GET' },
        })
      ).toBeNull();
    }
  );

  it('keeps the breadcrumb of a request started elsewhere', () => {
    let pathname = '/embed';
    const options = sentryPrivacyOptions(() => pathname);
    const embedUrl = 'https://raw.githubusercontent.com/o/r/main/a.erd.json';
    const url = 'https://raw.githubusercontent.com/o/r/main/b.erd.json';

    options.tracing.shouldCreateSpanForRequest(embedUrl);
    pathname = '/';
    options.tracing.shouldCreateSpanForRequest(url);
    expect(
      options.init.beforeBreadcrumb({
        category: 'fetch',
        data: { url, method: 'GET' },
      })
    ).toEqual({ category: 'fetch', data: { url, method: 'GET' } });
    expect(
      options.init.beforeBreadcrumb({
        category: 'fetch',
        data: { url: '/live/?x=1', method: 'GET' },
      })
    ).toEqual({ category: 'fetch', data: { url: '/live/', method: 'GET' } });
  });
});
