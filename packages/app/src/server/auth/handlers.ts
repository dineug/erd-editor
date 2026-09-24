import { randomBase64Url } from './base64url';
import {
  type CallbackError,
  type CallbackResult,
  renderCallbackPage,
  toCallbackError,
} from './callbackPage';
import {
  clearRefreshCookie,
  clearStateCookie,
  readCookie,
  REFRESH_COOKIE,
  REFRESH_COOKIE_AAD,
  refreshCookie,
  STATE_COOKIE,
  stateCookie,
} from './cookie';
import { type CookieKey, openValue, sealValue } from './cookieCrypto';
import {
  exchangeCode,
  GOOGLE_AUTHORIZE_URL,
  hasDriveFileScope,
  refreshAccessToken,
  revokeToken,
  SCOPES,
} from './google';
import { html, json, redirect } from './http';
import {
  ATTEMPT_PATTERN,
  createOAuthState,
  isLoginHint,
  openOAuthState,
  pkceChallenge,
  safeEqual,
  sealOAuthState,
} from './oauthState';
import { type ResolvedAuthDeps } from './types';

/** The configuration a handler runs with, the cookie key imported; null when not configured. */
export type RelaySecrets = {
  clientId: string;
  clientSecret: string;
  key: CookieKey;
};

/** A handler past routing: the method matched, and a POST passed guardRequest. */
export type AuthHandler = (
  request: Request,
  secrets: RelaySecrets | null,
  deps: ResolvedAuthDeps
) => Promise<Response>;

function callbackUrl(url: URL): string {
  return `${url.origin}/api/auth/callback`;
}

function notConfigured(deps: ResolvedAuthDeps): Response {
  deps.log('auth.not_configured');
  return json({ error: 'not_configured' }, { status: 503 });
}

function callbackPage(result: CallbackResult, cookies: string[]): Response {
  const nonce = randomBase64Url(16);
  return html(renderCallbackPage(result, nonce), nonce, {
    status: result.ok ? 200 : 400,
    cookies,
  });
}

/**
 * Opens a sign-in: seals state, PKCE verifier and the opener's attempt into the
 * state cookie and sends the popup to Google, asking for consent every time so
 * that each browser receives a refresh token of its own.
 */
export const handleStart: AuthHandler = async (request, secrets, deps) => {
  if (!secrets) return notConfigured(deps);
  const url = new URL(request.url);
  const attempt = url.searchParams.get('attempt');
  const loginHint = url.searchParams.get('login_hint');
  if (
    (attempt !== null && !ATTEMPT_PATTERN.test(attempt)) ||
    (loginHint !== null && !isLoginHint(loginHint))
  ) {
    return json({ error: 'invalid_request' }, { status: 400 });
  }

  const oauth = createOAuthState(attempt, deps.now());
  const params = new URLSearchParams({
    client_id: secrets.clientId,
    redirect_uri: callbackUrl(url),
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: loginHint ? 'consent' : 'consent select_account',
    include_granted_scopes: 'true',
    code_challenge: await pkceChallenge(oauth.verifier),
    code_challenge_method: 'S256',
    state: oauth.state,
  });
  if (loginHint) params.set('login_hint', loginHint);

  deps.log('auth.start');
  return redirect(`${GOOGLE_AUTHORIZE_URL}?${params}`, {
    cookies: [stateCookie(await sealOAuthState(secrets.key, oauth))],
  });
};

/**
 * Where Google sends the popup back. The attempt comes out of the state cookie
 * and only when its state matches, so a link made elsewhere reaches no opener.
 */
export const handleCallback: AuthHandler = async (request, secrets, deps) => {
  if (!secrets) return notConfigured(deps);
  const url = new URL(request.url);
  const cookies = [clearStateCookie()];
  const sealed = readCookie(request, STATE_COOKIE);
  const oauth =
    sealed && (await openOAuthState(secrets.key, sealed, deps.now()));
  const state = url.searchParams.get('state') ?? '';
  if (!oauth || !safeEqual(state, oauth.state)) {
    deps.log('auth.callback.state_mismatch');
    return callbackPage(
      { ok: false, error: 'state_mismatch', attempt: null },
      cookies
    );
  }

  const fail = (error: CallbackError) => {
    deps.log(`auth.callback.${error}`);
    return callbackPage({ ok: false, error, attempt: oauth.attempt }, cookies);
  };
  const googleError = url.searchParams.get('error');
  if (googleError !== null) return fail(toCallbackError(googleError));
  const code = url.searchParams.get('code');
  if (!code) return fail('unknown');

  const result = await exchangeCode(deps, {
    clientId: secrets.clientId,
    clientSecret: secrets.clientSecret,
    code,
    codeVerifier: oauth.verifier,
    redirectUri: callbackUrl(url),
  });
  if (!result.ok) return fail(result.error);
  // Consent is granular: a person may sign in and leave Drive unchecked, and a
  // refresh cookie without Drive would keep a useless session for 180 days.
  if (!hasDriveFileScope(result.grant.scope)) return fail('scope_missing');
  if (!result.grant.refreshToken) return fail('upstream');

  const sealedToken = await sealValue(
    secrets.key,
    result.grant.refreshToken,
    REFRESH_COOKIE_AAD
  );
  deps.log('auth.callback.ok');
  return callbackPage({ ok: true, error: null, attempt: oauth.attempt }, [
    ...cookies,
    refreshCookie(sealedToken),
  ]);
};

/**
 * Trades the refresh cookie for an access token and renews the cookie for
 * another 180 days, with Google's new refresh token when it sends one.
 */
export const handleToken: AuthHandler = async (request, secrets, deps) => {
  const sealed = readCookie(request, REFRESH_COOKIE);
  if (!sealed) return json({ error: 'signed_out' }, { status: 401 });
  if (!secrets) return notConfigured(deps);

  const refreshToken = await openValue(secrets.key, sealed, REFRESH_COOKIE_AAD);
  if (refreshToken === null) {
    deps.log('auth.token.unreadable_cookie');
    return json(
      { error: 'invalid_cookie' },
      { status: 401, cookies: [clearRefreshCookie()] }
    );
  }

  const result = await refreshAccessToken(deps, {
    clientId: secrets.clientId,
    clientSecret: secrets.clientSecret,
    refreshToken,
  });
  if (!result.ok && result.error === 'invalid_grant') {
    deps.log('auth.token.invalid_grant');
    return json(
      { error: 'invalid_grant' },
      { status: 401, cookies: [clearRefreshCookie()] }
    );
  }
  if (!result.ok) return json({ error: 'upstream' }, { status: 502 });

  const renewed = await sealValue(
    secrets.key,
    result.grant.refreshToken ?? refreshToken,
    REFRESH_COOKIE_AAD
  );
  return json(
    {
      access_token: result.grant.accessToken,
      expires_in: result.grant.expiresIn,
      scope: result.grant.scope,
    },
    { cookies: [refreshCookie(renewed)] }
  );
};

/**
 * Revokes the grant at Google, which signs every device of the account out of
 * the app, and clears the cookie whether or not Google could be reached.
 */
export const handleLogout: AuthHandler = async (request, secrets, deps) => {
  const sealed = readCookie(request, REFRESH_COOKIE);
  const refreshToken =
    sealed &&
    secrets &&
    (await openValue(secrets.key, sealed, REFRESH_COOKIE_AAD));
  const revoked = refreshToken ? await revokeToken(deps, refreshToken) : false;
  deps.log('auth.logout');
  return json({ ok: true, revoked }, { cookies: [clearRefreshCookie()] });
};
