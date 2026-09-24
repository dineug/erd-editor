import { createHash } from 'node:crypto';
import { createServer } from 'node:http';

// Google's token and revoke endpoints for the dev relay under e2e. A code is
// bound to the client, redirect_uri and PKCE challenge the fake authorize page
// registered it with, and a refresh token lives until revoked.
const port = Number(process.argv[2] ?? 5178);
const CLIENT_ID = process.env.E2E_GOOGLE_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.E2E_GOOGLE_CLIENT_SECRET ?? '';

let state;

function reset() {
  state = {
    /** @type {Map<string, {clientId: string, redirectUri: string, challenge: string, scope: string, sub: string}>} */
    codes: new Map(),
    /** @type {Map<string, {sub: string, scope: string}>} */
    refreshTokens: new Map(),
    issued: 0,
    expiresIn: 3599,
    exchanges: 0,
    refreshes: 0,
    revokes: 0,
  };
}
reset();

function send(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function s256(verifier) {
  return createHash('sha256').update(verifier).digest('base64url');
}

function accessToken(sub) {
  state.issued += 1;
  return `access-${sub}-${state.issued}`;
}

function refreshToken(sub) {
  state.issued += 1;
  return `refresh-${sub}-${state.issued}`;
}

function answerToken(response, params) {
  if (
    params.get('client_id') !== CLIENT_ID ||
    params.get('client_secret') !== CLIENT_SECRET
  ) {
    return send(response, 401, { error: 'invalid_client' });
  }

  if (params.get('grant_type') === 'authorization_code') {
    const code = params.get('code') ?? '';
    const entry = state.codes.get(code);
    state.codes.delete(code);
    if (
      !entry ||
      entry.clientId !== params.get('client_id') ||
      entry.redirectUri !== params.get('redirect_uri') ||
      entry.challenge !== s256(params.get('code_verifier') ?? '')
    ) {
      return send(response, 400, { error: 'invalid_grant' });
    }
    state.exchanges += 1;
    const refresh = refreshToken(entry.sub);
    state.refreshTokens.set(refresh, { sub: entry.sub, scope: entry.scope });
    return send(response, 200, {
      access_token: accessToken(entry.sub),
      expires_in: state.expiresIn,
      scope: entry.scope,
      token_type: 'Bearer',
      id_token: 'header.payload.signature',
      refresh_token: refresh,
    });
  }

  if (params.get('grant_type') === 'refresh_token') {
    const grant = state.refreshTokens.get(params.get('refresh_token') ?? '');
    if (!grant) return send(response, 400, { error: 'invalid_grant' });
    state.refreshes += 1;
    return send(response, 200, {
      access_token: accessToken(grant.sub),
      expires_in: state.expiresIn,
      scope: grant.scope,
      token_type: 'Bearer',
    });
  }

  return send(response, 400, { error: 'unsupported_grant_type' });
}

function answerRevoke(response, params) {
  state.revokes += 1;
  const token = params.get('token') ?? '';
  // A refresh token's grant goes with it; an access token of a grant ends it too.
  const sub = /^(?:access|refresh)-(.+)-\d+$/.exec(token)?.[1];
  if (!sub) return send(response, 400, { error: 'invalid_token' });
  for (const [refresh, grant] of state.refreshTokens) {
    if (grant.sub === sub) state.refreshTokens.delete(refresh);
  }
  return send(response, 200, {});
}

async function control(request, response, path) {
  if (path === '/__control/state') {
    return send(response, 200, {
      exchanges: state.exchanges,
      refreshes: state.refreshes,
      revokes: state.revokes,
      liveRefreshTokens: state.refreshTokens.size,
    });
  }
  if (path === '/__control/reset') {
    reset();
    return send(response, 200, {});
  }
  const body = JSON.parse((await readBody(request)) || '{}');
  if (path === '/__control/code') {
    state.codes.set(body.code, {
      clientId: body.clientId,
      redirectUri: body.redirectUri,
      challenge: body.challenge,
      scope: body.scope,
      sub: body.sub,
    });
    return send(response, 200, {});
  }
  if (path === '/__control/config') {
    if (typeof body.expiresIn === 'number') state.expiresIn = body.expiresIn;
    return send(response, 200, {});
  }
  return send(response, 404, { error: 'not_found' });
}

const server = createServer((request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (path === '/health') {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('ok');
    return;
  }
  // Another origin on the loopback, whose page frames the app for the
  // clickjacking spec; a routed origin would count as public to Chrome.
  if (path === '/__framer') {
    const src = new URL(request.url ?? '/', 'http://localhost').searchParams.get('src') ?? '';
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(
      `<!doctype html><title>Framer</title><iframe src="${encodeURI(src)}" width="1200" height="800"></iframe>`
    );
    return;
  }
  const handle = async () => {
    if (path.startsWith('/__control/')) return control(request, response, path);
    if (request.method !== 'POST') {
      return send(response, 405, { error: 'method_not_allowed' });
    }
    const type = (request.headers['content-type'] ?? '').split(';')[0].trim();
    const params = new URLSearchParams(await readBody(request));
    if (type !== 'application/x-www-form-urlencoded') {
      return send(response, 400, { error: 'invalid_request' });
    }
    if (path === '/token') return answerToken(response, params);
    if (path === '/revoke') return answerRevoke(response, params);
    return send(response, 404, { error: 'not_found' });
  };
  handle().catch(error => {
    console.error('[fake google oauth]', error);
    send(response, 500, { error: 'internal' });
  });
});

server.listen(port, 'localhost');
