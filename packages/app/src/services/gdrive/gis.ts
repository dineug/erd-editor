/**
 * The part of Google Identity Services /gdrive uses: the token client of the
 * fallback, typed by hand from its JS reference rather than through a wrapper.
 */
export type GisTokenResponse = {
  access_token?: string;
  expires_in?: number | string;
  scope?: string;
  error?: string;
};

export type GisError = {
  type: 'popup_failed_to_open' | 'popup_closed' | 'unknown' | (string & {});
};

export type GisTokenClientConfig = {
  client_id: string;
  scope: string;
  callback: (response: GisTokenResponse) => void;
  error_callback?: (error: GisError) => void;
};

export type GisTokenRequest = {
  prompt?: '' | 'consent' | 'select_account';
  login_hint?: string;
};

export type GisTokenClient = {
  requestAccessToken(overrides?: GisTokenRequest): void;
};

export type GisOAuth2 = {
  initTokenClient(config: GisTokenClientConfig): GisTokenClient;
  revoke(accessToken: string, done?: () => void): void;
};

export const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
export const GIS_LOAD_TIMEOUT_MS = 10_000;

/** The script did not load in time or at all, as behind a blocker. */
export class GisBlockedError extends Error {
  name = 'GisBlockedError';

  constructor() {
    super('Google sign-in could not load');
  }
}

export type GisLoaderDeps = {
  document?: Pick<Document, 'createElement' | 'head'>;
  getOAuth2?: () => GisOAuth2 | undefined;
  timeoutMs?: number;
};

function globalOAuth2(): GisOAuth2 | undefined {
  const scope = globalThis as {
    google?: { accounts?: { oauth2?: GisOAuth2 } };
  };
  return scope.google?.accounts?.oauth2;
}

/**
 * A loader that adds the script once and hands every caller the same promise;
 * a failed load removes its tag, so the next call tries again.
 */
export function createGisLoader({
  document: doc = globalThis.document,
  getOAuth2 = globalOAuth2,
  timeoutMs = GIS_LOAD_TIMEOUT_MS,
}: GisLoaderDeps = {}): () => Promise<GisOAuth2> {
  let loading: Promise<GisOAuth2> | null = null;

  return () => {
    loading ??= new Promise<GisOAuth2>((resolve, reject) => {
      const loaded = getOAuth2();
      if (loaded) return resolve(loaded);

      const script = doc.createElement('script');
      let settled = false;
      const settle = (oauth2: GisOAuth2 | undefined) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (oauth2) return resolve(oauth2);
        script.remove();
        loading = null;
        reject(new GisBlockedError());
      };
      const timer = setTimeout(() => settle(undefined), timeoutMs);

      script.src = GIS_SCRIPT_URL;
      script.async = true;
      script.addEventListener('load', () => settle(getOAuth2()));
      script.addEventListener('error', () => settle(undefined));
      doc.head.append(script);
    });
    return loading;
  };
}

/** The page's one loader; nothing loads until the fallback asks for it. */
export const loadGis = createGisLoader();
