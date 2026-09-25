import type {
  Breadcrumb,
  BrowserOptions,
  ErrorEvent,
  Event,
} from '@sentry/react';

type TransactionEvent = Parameters<
  NonNullable<BrowserOptions['beforeSendTransaction']>
>[0];
type SpanJson = Parameters<NonNullable<BrowserOptions['beforeSendSpan']>>[0];
type SpanData = Record<string, unknown>;

/**
 * What Limited Use keeps out of Sentry on /gdrive: Drive file ids, which sit in
 * the path of every Drive URL, file names in ui breadcrumbs, and the ?state= and
 * ?file= of the route, which carry ids and the account's OpenID sub.
 */
const GOOGLE_HOST =
  /^https?:\/\/[^/?#]*\.(?:googleapis|google)\.com(?:[/?#]|$)/;
const PRIVATE_PATH =
  /^(?:https?:\/\/[^/?#]+)?\/(?:gdrive|api\/auth)(?:[/?#]|$)/i;
const GDRIVE_PATH = /^(?:https?:\/\/[^/?#]+)?\/gdrive(?:[/?#]|$)/i;
const FILE_ID = /(\/files\/)[^/?#]+/g;
const UNTRACED = /googleapis\.com|accounts\.google\.com|\/api\/auth\//;
const URL_KEYS = ['url', 'http.url', 'url.full', 'from', 'to'];
/** Web vitals name the element they measured, with its aria-label and title. */
const ELEMENT_KEY = /^(?:lcp\.(?:element|id|url)|cls\.source\.\d+)$/;
const FILTERED = '[Filtered]';

/** The router matches a percent-decoded path in any case: /GDrive and /%67drive are /gdrive. */
function decoded(url: string): string {
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
}

function isPrivateUrl(url: string): boolean {
  return GOOGLE_HOST.test(url) || PRIVATE_PATH.test(decoded(url));
}

/** Whether a path, URL or route name is /gdrive. */
function isOnGdrive(pathname: string): boolean {
  return GDRIVE_PATH.test(decoded(pathname));
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

/** The URLs of span or breadcrumb data scrubbed, and the query and fragment of a private one dropped. */
function scrubData(data: SpanData | undefined) {
  if (!data) return;
  let exposed = false;
  for (const key of URL_KEYS) {
    const value = data[key];
    if (typeof value !== 'string' || !isPrivateUrl(value)) continue;
    exposed = true;
    data[key] = scrubUrl(value);
  }
  if (exposed) {
    delete data['http.query'];
    delete data['http.fragment'];
  }
}

/** Drops the web vitals' element names, measured on /gdrive. */
function dropElements(data: SpanData) {
  for (const key of Object.keys(data)) {
    if (ELEMENT_KEY.test(key)) delete data[key];
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

/**
 * The event with every URL it carries scrubbed: request, referrer, transaction,
 * the root span's data, spans and breadcrumbs. A /gdrive transaction also loses
 * the elements its web vitals name.
 */
export function scrubEvent<T extends Event>(event: T): T {
  const { request } = event;
  if (request?.url !== undefined) {
    const url = scrubUrl(request.url);
    if (url !== request.url) delete request.query_string;
    request.url = url;
  }
  scrubHeaders(request?.headers);
  const trace = event.contexts?.trace;
  if (trace?.data) {
    scrubData(trace.data);
    if (isOnGdrive(event.transaction ?? '')) dropElements(trace.data);
  }
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

/**
 * A span as Sentry sends it, alone like the INP of an interaction or within a
 * transaction. On /gdrive an interaction is named after its element, whose
 * aria-label or title can be a file name or the account's email.
 */
export function scrubSpan(span: SpanJson, onGdrive: boolean): SpanJson {
  if (span.description !== undefined) {
    span.description = scrubText(span.description);
  }
  scrubData(span.data);
  if (onGdrive) {
    if (span.op?.startsWith('ui.interaction.')) span.description = FILTERED;
    if (span.data) dropElements(span.data);
  }
  return span;
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
 * read whenever one runs. An interaction's span goes when the tab is hidden,
 * perhaps after Back left /gdrive, so a page that showed /gdrive stays marked.
 */
export function sentryPrivacyOptions(pathname: () => string) {
  let showedGdrive = false;
  const onGdrive = (route?: unknown) => {
    showedGdrive ||=
      isOnGdrive(pathname()) ||
      (typeof route === 'string' && isOnGdrive(route));
    return showedGdrive;
  };

  return {
    beforeBreadcrumb: (breadcrumb: Breadcrumb) => {
      onGdrive();
      return filterBreadcrumb(breadcrumb, pathname());
    },
    beforeSend: (event: ErrorEvent) => {
      onGdrive();
      return scrubEvent(event);
    },
    beforeSendTransaction: (event: TransactionEvent) => {
      onGdrive(event.transaction);
      return scrubEvent(event);
    },
    beforeSendSpan: (span: SpanJson) =>
      scrubSpan(span, onGdrive(span.data?.transaction)),
  };
}
