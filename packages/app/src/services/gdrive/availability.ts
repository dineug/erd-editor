/**
 * Whether /gdrive can run here: a build without a client id is not configured,
 * and an origin the OAuth client does not list, a preview deploy on pages.dev
 * among them, can never finish a sign-in.
 */
export type Availability = 'not-configured' | 'unsupported-origin' | 'ready';

export const PRODUCTION_ORIGIN = 'https://erd-editor.io';

const LOCAL_ORIGIN = /^http:\/\/localhost(?::\d{1,5})?$/;

/** An empty value counts as missing, as Vite reads an empty variable. */
export function readClientId(value: string | undefined): string | null {
  return value?.trim() || null;
}

/** The client id this build was made with. */
export function configuredClientId(): string | null {
  return readClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID);
}

export function isSupportedOrigin(origin: string): boolean {
  return origin === PRODUCTION_ORIGIN || LOCAL_ORIGIN.test(origin);
}

export function checkAvailability(
  clientId: string | null,
  origin: string
): Availability {
  if (!clientId) return 'not-configured';
  return isSupportedOrigin(origin) ? 'ready' : 'unsupported-origin';
}

/**
 * Whether the page sits in a frame. Comparing top with self is allowed across
 * origins; a browser that throws on it anyway is taken as framed.
 */
export function isFramed(win: { top: unknown; self: unknown }): boolean {
  try {
    return win.top !== win.self;
  } catch {
    return true;
  }
}
