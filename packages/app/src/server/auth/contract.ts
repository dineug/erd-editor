// What the /gdrive client shares with the relay. It imports nothing and declares
// constants and pure functions only, so the client chunk that takes it takes no
// server code with it (imports.test.ts).

/** The channel the callback page posts oauth-done on, for the popup's opener. */
export const AUTH_CHANNEL = '@dineug/erd-editor-app/gdrive-auth';

/** The meta element that tells the callback page from any other same-origin page. */
export const CALLBACK_MARKER = 'erd-editor-auth-callback';

export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/** What every sign-in asks for, the relay's and the token client's alike. */
export const SCOPES = [
  DRIVE_FILE_SCOPE,
  'https://www.googleapis.com/auth/drive.install',
  'openid',
  'email',
];

export function hasDriveFileScope(scope: string): boolean {
  return scope.split(' ').includes(DRIVE_FILE_SCOPE);
}

const LOGIN_HINT_MAX_LENGTH = 256;
const SUBJECT_PATTERN = /^[0-9]+$/;
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$/;

/**
 * An account id or an email address, the two things a Drive state or a person
 * supplies. The relay's start refuses any other login_hint, so the client
 * drops one before it opens the popup.
 */
export function isLoginHint(value: string): boolean {
  return (
    value.length <= LOGIN_HINT_MAX_LENGTH &&
    (SUBJECT_PATTERN.test(value) || EMAIL_PATTERN.test(value))
  );
}
