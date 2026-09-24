import type {
  Breadcrumb,
  BrowserOptions,
  ErrorEvent,
  Event,
} from '@sentry/react';

type TransactionEvent = Parameters<
  NonNullable<BrowserOptions['beforeSendTransaction']>
>[0];

/**
 * What Limited Use keeps out of Sentry on /gdrive: Drive file ids, which sit in
 * the path of every Drive URL, file names in ui breadcrumbs, and the ?state= and
 * ?file= of the route, which carry ids and the account's OpenID sub.
 */
const GOOGLE_HOST =
  /^https?:\/\/[^/?#]*\.(?:googleapis|google)\.com(?:[/?#]|$)/;
const PRIVATE_PATH =
  /^(?:https?:\/\/[^/?#]+)?\/(?:gdrive|api\/auth)(?:[/?#]|$)/;
const FILE_ID = /(\/files\/)[^/?#]+/g;
const UNTRACED = /googleapis\.com|accounts\.google\.com|\/api\/auth\//;

function isPrivateUrl(url: string): boolean {
  return GOOGLE_HOST.test(url) || PRIVATE_PATH.test(url);
}

/**
 * A Drive or /gdrive URL without its file ids, query and fragment; any other
 * URL as it is.
 */
export function scrubUrl(url: string): string {
  if (!isPrivateUrl(url)) return url;
  return url.replace(/[?#].*$/s, '').replace(FILE_ID, '$1[id]');
}

/** Each word of a span description, such as GET and its URL, scrubbed alone. */
function scrubText(text: string): string {
  return text.split(' ').map(scrubUrl).join(' ');
}

/** Whether a request gets a span: never one to Google or the auth relay. */
export function shouldCreateSpanForRequest(url: string): boolean {
  return !UNTRACED.test(url);
}

function scrubData(data: Record<string, unknown> | undefined) {
  if (!data) return;
  for (const key of ['url', 'http.url', 'from', 'to']) {
    const value = data[key];
    if (typeof value === 'string') data[key] = scrubUrl(value);
  }
}

function scrubHeaders(headers: Record<string, string> | undefined) {
  if (!headers) return;
  for (const name of Object.keys(headers)) {
    if (name.toLowerCase() === 'referer') {
      headers[name] = scrubUrl(headers[name]);
    }
  }
}

/** The event with every URL it carries scrubbed: request, referrer, transaction, spans and breadcrumbs. */
export function scrubEvent<T extends Event>(event: T): T {
  const { request } = event;
  if (request?.url !== undefined) {
    const url = scrubUrl(request.url);
    if (url !== request.url) delete request.query_string;
    request.url = url;
  }
  scrubHeaders(request?.headers);
  if (event.transaction !== undefined) {
    event.transaction = scrubUrl(event.transaction);
  }
  for (const span of event.spans ?? []) {
    if (span.description !== undefined) {
      span.description = scrubText(span.description);
    }
    scrubData(span.data);
  }
  for (const breadcrumb of event.breadcrumbs ?? []) {
    scrubData(breadcrumb.data);
  }
  return event;
}

function isOnGdrive(pathname: string): boolean {
  return pathname === '/gdrive' || pathname.startsWith('/gdrive/');
}

function hasQuery(value: unknown): boolean {
  return typeof value === 'string' && /[?#]/.test(value);
}

/**
 * Drops what could carry Google data and scrubs the rest. On /gdrive a ui
 * breadcrumb names what was clicked, "Actions for <file name>" among them, and
 * a navigation with a query carries ?state= or ?file=.
 */
export function filterBreadcrumb(
  breadcrumb: Breadcrumb,
  pathname: string
): Breadcrumb | null {
  const { category = '', data } = breadcrumb;
  const url = data?.url;
  if (
    (category === 'fetch' || category === 'xhr') &&
    typeof url === 'string' &&
    !shouldCreateSpanForRequest(url)
  ) {
    return null;
  }
  if (isOnGdrive(pathname)) {
    if (category.startsWith('ui.')) return null;
    if (
      category === 'navigation' &&
      (hasQuery(data?.from) || hasQuery(data?.to))
    ) {
      return null;
    }
  }
  scrubData(breadcrumb.data);
  return breadcrumb;
}

/**
 * The Sentry options that apply the rules above, for Sentry.init; pathname is
 * read at the moment a breadcrumb is recorded.
 */
export function sentryPrivacyOptions(pathname: () => string) {
  return {
    beforeBreadcrumb: (breadcrumb: Breadcrumb) =>
      filterBreadcrumb(breadcrumb, pathname()),
    beforeSend: (event: ErrorEvent) => scrubEvent(event),
    beforeSendTransaction: (event: TransactionEvent) => scrubEvent(event),
  };
}
