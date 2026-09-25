import { CALLBACK_MARKER } from './contract';
import { escapeHtml } from './http';

/** Every failure the page can report. Nothing from the request is shown or echoed. */
export type CallbackError =
  | 'access_denied'
  | 'state_mismatch'
  | 'invalid_grant'
  | 'scope_missing'
  | 'upstream'
  | 'unknown';

export type CallbackResult = {
  ok: boolean;
  error: CallbackError | null;
  attempt: string | null;
};

/**
 * Constant text with no interpolation: the result reaches it through the
 * marker's data attributes, so no value is ever written into script. No
 * attempt, no message. The test pins the marker and channel names in it.
 */
const CALLBACK_SCRIPT = `
      (function () {
        var meta = document.querySelector('meta[name="erd-editor-auth-callback"]');
        var data = meta ? meta.dataset : {};
        if (data.attempt) {
          try {
            new BroadcastChannel('@dineug/erd-editor-app/gdrive-auth').postMessage({
              type: 'oauth-done',
              attempt: data.attempt,
              ok: data.ok === 'true',
              error: data.error || null,
            });
          } catch (error) {}
        }
        window.close();
      })();
    `;

/** Google's own error values pass through as access_denied or not at all. */
export function toCallbackError(googleError: string): CallbackError {
  return googleError === 'access_denied' ? 'access_denied' : 'unknown';
}

export function renderCallbackPage(
  { ok, error, attempt }: CallbackResult,
  nonce: string
): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="${CALLBACK_MARKER}" data-ok="${ok}" data-error="${escapeHtml(error ?? '')}" data-attempt="${escapeHtml(attempt ?? '')}" />
    <title>erd-editor</title>
  </head>
  <body>
    <p>You can close this window.</p>
    <script nonce="${escapeHtml(nonce)}">${CALLBACK_SCRIPT}</script>
  </body>
</html>
`;
}
