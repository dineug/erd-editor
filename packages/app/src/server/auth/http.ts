export type ResponseOptions = {
  status?: number;
  cookies?: string[];
  headers?: Record<string, string>;
};

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function respond(
  body: string | null,
  { status = 200, cookies = [], headers = {} }: ResponseOptions
): Response {
  const result = new Headers({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  for (const cookie of cookies) result.append('Set-Cookie', cookie);
  return new Response(body, { status, headers: result });
}

export function json(body: unknown, options: ResponseOptions = {}): Response {
  return respond(JSON.stringify(body), {
    ...options,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...options.headers,
    },
  });
}

/** A page whose one script carries the nonce, which nothing it shows can extend. */
export function html(
  body: string,
  nonce: string,
  options: ResponseOptions = {}
): Response {
  return respond(body, {
    ...options,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      'Referrer-Policy': 'no-referrer',
      ...options.headers,
    },
  });
}

export function redirect(
  location: string,
  options: ResponseOptions = {}
): Response {
  return respond(null, {
    ...options,
    status: 302,
    headers: {
      Location: location,
      'Referrer-Policy': 'no-referrer',
      ...options.headers,
    },
  });
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => HTML_ESCAPES[char]);
}

/**
 * The CSRF gate of every POST: the Origin must be this origin exactly, and a
 * header only a script can add must be present. Null lets the request through.
 */
export function guardRequest(request: Request): Response | null {
  const origin = request.headers.get('Origin');
  const requestedWith = request.headers.get('X-Requested-With');
  if (
    origin !== new URL(request.url).origin ||
    requestedWith !== 'XMLHttpRequest'
  ) {
    return json({ error: 'forbidden' }, { status: 403 });
  }
  return null;
}
