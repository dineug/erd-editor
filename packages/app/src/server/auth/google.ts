import type { ResolvedAuthDeps } from './types';

export const GOOGLE_AUTHORIZE_URL =
  'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const SCOPES = [
  DRIVE_FILE_SCOPE,
  'https://www.googleapis.com/auth/drive.install',
  'openid',
  'email',
];

export type TokenGrant = {
  accessToken: string;
  expiresIn: number;
  refreshToken: string | null;
  scope: string;
};

export type GoogleResult =
  | { ok: true; grant: TokenGrant }
  | { ok: false; error: 'invalid_grant' | 'upstream' };

/** Null once a network error or a 5xx has happened twice; one retry, no wait. */
async function post(
  deps: ResolvedAuthDeps,
  url: string,
  params: URLSearchParams
): Promise<Response | null> {
  const send = deps.fetch;
  const init = {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  };
  for (let tries = 0; tries < 2; tries++) {
    if (tries > 0) deps.log('auth.upstream.retry');
    const response = await send(url, init).catch(() => null);
    if (response && response.status < 500) return response;
  }
  return null;
}

async function readJson(
  response: Response
): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await response.json();
    return typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function requestToken(
  deps: ResolvedAuthDeps,
  params: URLSearchParams
): Promise<GoogleResult> {
  const response = await post(deps, deps.tokenUrl, params);
  const body = response && (await readJson(response));
  if (!response?.ok) {
    return {
      ok: false,
      error: body?.error === 'invalid_grant' ? 'invalid_grant' : 'upstream',
    };
  }
  if (
    typeof body?.access_token !== 'string' ||
    typeof body.expires_in !== 'number'
  ) {
    return { ok: false, error: 'upstream' };
  }
  return {
    ok: true,
    grant: {
      accessToken: body.access_token,
      expiresIn: body.expires_in,
      refreshToken:
        typeof body.refresh_token === 'string' ? body.refresh_token : null,
      scope: typeof body.scope === 'string' ? body.scope : '',
    },
  };
}

type Client = { clientId: string; clientSecret: string };

export function exchangeCode(
  deps: ResolvedAuthDeps,
  {
    clientId,
    clientSecret,
    code,
    codeVerifier,
    redirectUri,
  }: Client & { code: string; codeVerifier: string; redirectUri: string }
): Promise<GoogleResult> {
  return requestToken(
    deps,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    })
  );
}

export function refreshAccessToken(
  deps: ResolvedAuthDeps,
  { clientId, clientSecret, refreshToken }: Client & { refreshToken: string }
): Promise<GoogleResult> {
  return requestToken(
    deps,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    })
  );
}

/** True once the token no longer works, including when Google says it already did not. */
export async function revokeToken(
  deps: ResolvedAuthDeps,
  token: string
): Promise<boolean> {
  const response = await post(
    deps,
    deps.revokeUrl,
    new URLSearchParams({ token })
  );
  if (!response) return false;
  if (response.ok) return true;
  return (await readJson(response))?.error === 'invalid_token';
}

export function hasDriveFileScope(scope: string): boolean {
  return scope.split(' ').includes(DRIVE_FILE_SCOPE);
}
