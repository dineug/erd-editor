import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  createChannelHub,
  createFakeGis,
  createFakePopup,
  createFakeRelay,
  createLockManager,
  htmlReply,
  jsonReply,
  receiverChecked,
} from '@/__test-utils__/gdrive';
import { AUTH_CHANNEL } from '@/server/auth/callbackPage';
import { GOOGLE_REVOKE_URL } from '@/server/auth/google';
import {
  LOGOUT_PENDING_KEY,
  RELAY_LOGOUT_PATH,
  RELAY_TIMEOUT_MS,
  RELAY_TOKEN_PATH,
  UNAVAILABLE_UNTIL_KEY,
} from '@/services/gdrive/authMode';
import { GisBlockedError } from '@/services/gdrive/gis';
import { CALLBACK_GRACE_MS, POPUP_POLL_MS } from '@/services/gdrive/oauthPopup';
import {
  ADOPT_WAIT_MS,
  AUTH_CONTROL_ATTRIBUTE,
  createTokenManager,
  fetchUserInfo,
  isAuthControlGesture,
  isEditingGesture,
  lacksDriveScope,
  MIN_RENEW_DELAY_MS,
  REFRESH_LOCK,
  REFRESH_MARGIN_MS,
  RETRY_REFRESH_MS,
  revokeAtGoogle,
  TOKEN_CHANNEL,
  TokenUnavailableError,
  USERINFO_URL,
} from '@/services/gdrive/tokenManager';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const NOON = Date.UTC(2026, 8, 25, 12);
const HOUR = 3_600_000;
const NO_DRIVE = 'openid https://www.googleapis.com/auth/userinfo.email';
const MIDNIGHT = Date.UTC(2026, 8, 26);

type Browser = ReturnType<typeof createBrowser>;
type Tab = ReturnType<typeof openTab>;

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

/** What the tabs of one browser share: channels, locks, storage, the relay and its cookie. */
function createBrowser() {
  return {
    hub: createChannelHub(),
    locks: createLockManager(),
    relay: createFakeRelay(),
    storage: memoryStorage(),
    online: true,
    tabs: [] as Array<{ manager: { dispose(): void } }>,
  };
}

function openTab(
  browser: Browser,
  { loadGis }: { loadGis?: () => Promise<never> } = {}
) {
  const events = new EventTarget();
  const doc = Object.assign(new EventTarget(), {
    visibilityState: 'visible' as DocumentVisibilityState,
  });
  const gis = createFakeGis();
  const popup = createFakePopup();
  const opened: string[] = [];
  const manager = createTokenManager({
    fetch: browser.relay.fetch,
    clientId: CLIENT_ID,
    createChannel: browser.hub.create,
    locks: browser.locks,
    storage: browser.storage,
    loadGis: loadGis ?? gis.load,
    openWindow: url => {
      opened.push(url);
      return popup.window;
    },
    events,
    document: doc,
    isOnline: () => browser.online,
  });
  const tab = { manager, events, doc, gis, popup, opened };
  browser.tabs.push(tab);
  return tab;
}

/**
 * Runs what is due. A timer set while fake timers tick waits a millisecond, so
 * a message one tab posts from a timer reaches the others one millisecond on.
 */
function flush() {
  return vi.advanceTimersByTimeAsync(1);
}

async function start(tab: Tab) {
  const started = tab.manager.start();
  await vi.advanceTimersByTimeAsync(ADOPT_WAIT_MS);
  await started;
}

/** The popup's callback page reporting to the opener that made this attempt. */
function finishPopup(
  browser: Browser,
  tab: Tab,
  ok = true,
  error: string | null = null
) {
  const url = new URL(tab.opened.at(-1) ?? '', 'https://erd-editor.io');
  browser.hub.broadcast(AUTH_CHANNEL, {
    type: 'oauth-done',
    attempt: url.searchParams.get('attempt'),
    ok,
    error,
  });
}

function click(tab: Tab, target?: EventTarget) {
  const event = new MouseEvent('click', { bubbles: true, composed: true });
  if (target) {
    Object.defineProperty(event, 'composedPath', {
      value: () => [target, tab.events],
    });
  }
  tab.events.dispatchEvent(event);
}

function grant(
  browser: Browser,
  expiresIn = 3599,
  scope = 'openid https://www.googleapis.com/auth/drive.file'
) {
  return { access_token: browser.relay.issue(), expires_in: expiresIn, scope };
}

describe('createTokenManager', () => {
  let browser: Browser;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOON);
    browser = createBrowser();
  });

  afterEach(() => {
    for (const tab of browser.tabs) tab.manager.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('the server mode', () => {
    it('finds the token through the relay, with the account from userinfo', async () => {
      const tab = openTab(browser);

      await start(tab);

      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'server',
        mode: 'server',
        account: { sub: 'sub-1', email: 'person@example.com' },
        expiresAt: NOON + ADOPT_WAIT_MS + 3600 * 1000,
        error: null,
      });
      expect(browser.relay.tokenCalls()).toBe(1);
      expect(browser.relay.count(USERINFO_URL)).toBe(1);
      expect(browser.locks.requests).toEqual([REFRESH_LOCK]);
      await expect(tab.manager.getAccessToken()).resolves.toBe('access-1');
    });

    it('lets a second tab take the first tab’s token, asking the relay nothing', async () => {
      const first = openTab(browser);
      await start(first);
      const second = openTab(browser);

      await start(second);

      expect(browser.relay.tokenCalls()).toBe(1);
      expect(browser.relay.count(USERINFO_URL)).toBe(1);
      expect(second.manager.getSnapshot()).toMatchObject({
        status: 'server',
        account: { sub: 'sub-1' },
      });
      await expect(second.manager.getAccessToken()).resolves.toBe('access-1');
    });

    it('renews once between two tabs whose timers fire together', async () => {
      const first = openTab(browser);
      await start(first);
      const second = openTab(browser);
      await start(second);

      await vi.advanceTimersByTimeAsync(3600 * 1000 - REFRESH_MARGIN_MS);
      await vi.advanceTimersByTimeAsync(ADOPT_WAIT_MS * 3);

      expect(browser.relay.tokenCalls()).toBe(2);
      await expect(first.manager.getAccessToken()).resolves.toBe('access-2');
      await expect(second.manager.getAccessToken()).resolves.toBe('access-2');
    });

    it('renews a token that lives five minutes and five seconds after five seconds', async () => {
      browser.relay.expiresIn = 305;
      const first = openTab(browser);
      await start(first);
      const second = openTab(browser);
      await vi.advanceTimersByTimeAsync(2000 - ADOPT_WAIT_MS);
      await start(second);

      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(ADOPT_WAIT_MS * 3);

      expect(browser.relay.tokenCalls()).toBe(2);
    });

    it('waits at least five seconds before renewing a token shorter than the margin', async () => {
      browser.relay.expiresIn = 60;
      const tab = openTab(browser);
      await start(tab);

      await vi.advanceTimersByTimeAsync(MIN_RENEW_DELAY_MS - 1);
      expect(browser.relay.tokenCalls()).toBe(1);
      await vi.advanceTimersByTimeAsync(1 + ADOPT_WAIT_MS);
      expect(browser.relay.tokenCalls()).toBe(2);
    });

    it('checks the expiry the moment a throttled tab shows again', async () => {
      const tab = openTab(browser);
      await start(tab);
      tab.doc.visibilityState = 'hidden';
      // A hidden tab's timers did not run while the hour passed.
      vi.setSystemTime(Date.now() + HOUR);
      expect(browser.relay.tokenCalls()).toBe(1);

      tab.doc.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(ADOPT_WAIT_MS);
      expect(browser.relay.tokenCalls()).toBe(1);

      tab.doc.visibilityState = 'visible';
      tab.doc.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(ADOPT_WAIT_MS);

      expect(browser.relay.tokenCalls()).toBe(2);
      await expect(tab.manager.getAccessToken()).resolves.toBe('access-2');
    });

    it('renews before handing out a token about to expire', async () => {
      const tab = openTab(browser);
      await start(tab);
      vi.setSystemTime(Date.now() + HOUR - 5000);

      const token = tab.manager.getAccessToken();
      await vi.advanceTimersByTimeAsync(ADOPT_WAIT_MS);

      await expect(token).resolves.toBe('access-2');
    });

    it('hands a late 401 the token renewed since, asking the relay nothing', async () => {
      const tab = openTab(browser);
      await start(tab);
      await vi.advanceTimersByTimeAsync(
        3600 * 1000 - REFRESH_MARGIN_MS + ADOPT_WAIT_MS
      );
      expect(browser.relay.tokenCalls()).toBe(2);

      await expect(tab.manager.onUnauthorized('access-1')).resolves.toBe(
        'access-2'
      );

      expect(browser.relay.tokenCalls()).toBe(2);
      expect(tab.manager.getSnapshot().status).toBe('server');
    });

    it('renews once for a 401 on the current token', async () => {
      const tab = openTab(browser);
      await start(tab);

      const renewed = tab.manager.onUnauthorized('access-1');
      await vi.advanceTimersByTimeAsync(ADOPT_WAIT_MS);

      await expect(renewed).resolves.toBe('access-2');
      expect(browser.relay.tokenCalls()).toBe(2);
    });

    it('is signed out when the relay has no cookie', async () => {
      browser.relay.signedIn = false;
      const tab = openTab(browser);

      await start(tab);

      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'signed-out',
        mode: 'server',
        account: null,
      });
      await expect(tab.manager.getAccessToken()).rejects.toMatchObject({
        status: 'signed-out',
      });
      await expect(tab.manager.onUnauthorized('x')).rejects.toBeInstanceOf(
        TokenUnavailableError
      );
    });

    it('signs every tab out once a renewal meets a revoked grant', async () => {
      const first = openTab(browser);
      await start(first);
      const second = openTab(browser);
      await start(second);
      browser.relay.queue(jsonReply({ error: 'invalid_grant' }, 401));

      const renewal = expect(
        first.manager.onUnauthorized('access-1')
      ).rejects.toMatchObject({ status: 'signed-out' });
      await vi.advanceTimersByTimeAsync(ADOPT_WAIT_MS);
      await renewal;
      await flush();
      expect(second.manager.getSnapshot()).toMatchObject({
        status: 'signed-out',
        account: null,
      });
    });

    it('stops for a token without drive.file, without reading the account', async () => {
      browser.relay.scope = NO_DRIVE;
      const tab = openTab(browser);

      await start(tab);

      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'scope-missing',
        mode: 'server',
      });
      expect(browser.relay.count(USERINFO_URL)).toBe(0);
    });

    it('takes a token whose scope the relay did not report', async () => {
      browser.relay.scope = null;
      const tab = openTab(browser);

      await start(tab);

      expect(tab.manager.getSnapshot().status).toBe('server');
    });

    it("stops on Drive's 403 for the scope", async () => {
      const tab = openTab(browser);
      await start(tab);

      tab.manager.reportInsufficientScope();

      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'scope-missing',
        account: { sub: 'sub-1' },
      });
      await expect(tab.manager.getAccessToken()).rejects.toMatchObject({
        status: 'scope-missing',
      });
    });

    it('offers sign-in again when userinfo fails on the first token', async () => {
      browser.relay.userInfoDown = true;
      const tab = openTab(browser);

      await start(tab);

      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'signed-out',
        error: 'failed',
      });
    });

    it('keeps the token and tries again later when userinfo fails on a renewal', async () => {
      const tab = openTab(browser);
      await start(tab);
      browser.relay.userInfoDown = true;

      await vi.advanceTimersByTimeAsync(
        3600 * 1000 - REFRESH_MARGIN_MS + ADOPT_WAIT_MS
      );
      expect(browser.relay.tokenCalls()).toBe(2);
      await expect(tab.manager.getAccessToken()).resolves.toBe('access-1');

      browser.relay.userInfoDown = false;
      await vi.advanceTimersByTimeAsync(RETRY_REFRESH_MS + ADOPT_WAIT_MS);

      expect(browser.relay.tokenCalls()).toBe(3);
      await expect(tab.manager.getAccessToken()).resolves.toBe('access-3');
    });

    it('lets the second tab renew when userinfo never answers the first, which holds the lock', async () => {
      const first = openTab(browser);
      await start(first);
      const second = openTab(browser);
      await start(second);
      browser.relay.stallUserInfo();

      await vi.advanceTimersByTimeAsync(
        3600 * 1000 - REFRESH_MARGIN_MS + ADOPT_WAIT_MS
      );
      expect(browser.relay.tokenCalls()).toBe(2);
      await vi.advanceTimersByTimeAsync(RELAY_TIMEOUT_MS + ADOPT_WAIT_MS);
      await flush();

      expect(browser.relay.tokenCalls()).toBe(3);
      await expect(second.manager.getAccessToken()).resolves.toBe('access-3');
      await expect(first.manager.getAccessToken()).resolves.toBe('access-3');
    });
  });

  describe('offline', () => {
    it('holds its judgement offline and decides once back online', async () => {
      browser.online = false;
      browser.relay.queue('network-error');
      const tab = openTab(browser);

      await start(tab);

      expect(tab.manager.getSnapshot().status).toBe('offline');
      expect(browser.storage.items.has(UNAVAILABLE_UNTIL_KEY)).toBe(false);

      browser.online = true;
      tab.events.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(ADOPT_WAIT_MS);

      expect(tab.manager.getSnapshot().status).toBe('server');
    });

    it('keeps a live token through an offline renewal and retries', async () => {
      const tab = openTab(browser);
      await start(tab);
      browser.online = false;
      browser.relay.queue('network-error');

      await vi.advanceTimersByTimeAsync(
        3600 * 1000 - REFRESH_MARGIN_MS + ADOPT_WAIT_MS
      );
      expect(tab.manager.getSnapshot().status).toBe('server');

      browser.online = true;
      tab.events.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(ADOPT_WAIT_MS);

      await expect(tab.manager.getAccessToken()).resolves.toBe('access-2');
    });
  });

  describe('signing in with the relay popup', () => {
    it('opens the popup and takes the token once the callback reports', async () => {
      browser.relay.signedIn = false;
      const tab = openTab(browser);
      await start(tab);
      browser.relay.signedIn = true;

      const result = tab.manager.signIn();
      expect(tab.opened).toHaveLength(1);
      expect(tab.opened[0]).toMatch(
        /^\/api\/auth\/start\?attempt=[A-Za-z0-9_-]{22}$/
      );
      expect(tab.manager.getSnapshot().signingIn).toBe(true);
      expect(tab.manager.signIn()).toBe(result);

      finishPopup(browser, tab);
      await flush();

      await expect(result).resolves.toBe('done');
      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'server',
        signingIn: false,
        account: { sub: 'sub-1' },
      });
    });

    it('switches accounts with a login hint, and the other tabs stop', async () => {
      const first = openTab(browser);
      await start(first);
      const second = openTab(browser);
      await start(second);

      const result = first.manager.signIn({ loginHint: 'sub-2' });
      expect(first.opened[0]).toContain('login_hint=sub-2');
      browser.relay.account = { sub: 'sub-2', email: 'other@example.com' };
      finishPopup(browser, first);
      await flush();

      await expect(result).resolves.toBe('done');
      expect(first.manager.getSnapshot()).toMatchObject({
        status: 'server',
        account: { sub: 'sub-2', email: 'other@example.com' },
      });
      await flush();
      expect(second.manager.getSnapshot()).toMatchObject({
        status: 'account-changed',
        account: { sub: 'sub-1' },
      });
      await expect(second.manager.getAccessToken()).rejects.toMatchObject({
        status: 'account-changed',
      });
    });

    it('stops a tab whose own renewal comes back for another account', async () => {
      const tab = openTab(browser);
      await start(tab);
      browser.relay.account = { sub: 'sub-2', email: 'other@example.com' };

      await vi.advanceTimersByTimeAsync(
        3600 * 1000 - REFRESH_MARGIN_MS + ADOPT_WAIT_MS
      );

      expect(tab.manager.getSnapshot().status).toBe('account-changed');
      await vi.advanceTimersByTimeAsync(HOUR);
      expect(browser.relay.tokenCalls()).toBe(2);
    });

    it('falls back when the token after the popup fails its contract', async () => {
      browser.relay.signedIn = false;
      const tab = openTab(browser);
      await start(tab);
      browser.relay.queue(htmlReply(200));

      const result = tab.manager.signIn();
      finishPopup(browser, tab);
      await flush();

      await expect(result).resolves.toBe('unavailable');
      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'signed-out',
        mode: 'fallback',
        gis: 'ready',
      });
      expect(browser.storage.items.has(UNAVAILABLE_UNTIL_KEY)).toBe(true);
    });

    it.each([
      [
        'scope_missing',
        'scope-missing',
        { status: 'scope-missing', error: null },
      ],
      ['access_denied', 'cancelled', { status: 'signed-out', error: null }],
      ['upstream', 'error', { status: 'signed-out', error: 'failed' }],
    ])('reads a callback with %s as %s', async (error, expected, snapshot) => {
      browser.relay.signedIn = false;
      const tab = openTab(browser);
      await start(tab);

      const result = tab.manager.signIn();
      finishPopup(browser, tab, false, error);
      await flush();

      await expect(result).resolves.toBe(expected);
      expect(tab.manager.getSnapshot()).toMatchObject(snapshot);
    });

    it('says the popup was blocked', async () => {
      browser.relay.signedIn = false;
      const tab = openTab(browser);
      await start(tab);
      const blocked = createTokenManager({
        fetch: browser.relay.fetch,
        clientId: CLIENT_ID,
        createChannel: browser.hub.create,
        locks: null,
        storage: null,
        loadGis: createFakeGis().load,
        openWindow: () => null,
        events: new EventTarget(),
        document: Object.assign(new EventTarget(), {
          visibilityState: 'visible' as const,
        }),
      });

      await expect(blocked.signIn()).resolves.toBe('blocked');
      expect(blocked.getSnapshot()).toMatchObject({
        signingIn: false,
        error: 'popup-blocked',
      });
      blocked.dispose();
    });

    it('cancels: the popup closes and one token request finds no cookie', async () => {
      browser.relay.signedIn = false;
      const tab = openTab(browser);
      await start(tab);

      const result = tab.manager.signIn();
      tab.manager.cancelSignIn();
      await flush();

      await expect(result).resolves.toBe('cancelled');
      expect(tab.popup.state.closed).toBe(true);
      expect(browser.relay.tokenCalls()).toBe(2);
    });

    it('still signs in when the popup finishes after it counted as cancelled', async () => {
      browser.relay.signedIn = false;
      const tab = openTab(browser);
      await start(tab);

      const result = tab.manager.signIn();
      tab.popup.state.closed = true;
      await vi.advanceTimersByTimeAsync(POPUP_POLL_MS);
      await expect(result).resolves.toBe('cancelled');

      browser.relay.signedIn = true;
      finishPopup(browser, tab);
      await flush();

      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'server',
        account: { sub: 'sub-1' },
      });
    });

    it('reads a scope_missing callback that crosses the token request of a close', async () => {
      browser.relay.signedIn = false;
      const tab = openTab(browser);
      await start(tab);
      const release = browser.relay.hold();

      const result = tab.manager.signIn();
      tab.popup.state.closed = true;
      await vi.advanceTimersByTimeAsync(POPUP_POLL_MS);
      expect(browser.relay.tokenCalls()).toBe(2);
      finishPopup(browser, tab, false, 'scope_missing');
      await flush();
      release();
      await flush();

      await expect(result).resolves.toBe('scope-missing');
      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'scope-missing',
        signingIn: false,
        error: null,
      });
    });

    it('takes a scope_missing callback that comes after the popup counted as cancelled', async () => {
      browser.relay.signedIn = false;
      const tab = openTab(browser);
      await start(tab);

      const result = tab.manager.signIn();
      tab.popup.state.closed = true;
      await vi.advanceTimersByTimeAsync(POPUP_POLL_MS);
      await expect(result).resolves.toBe('cancelled');
      finishPopup(browser, tab, false, 'scope_missing');
      await flush();

      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'scope-missing',
        mode: 'server',
      });
    });

    it('ignores a late callback failure', async () => {
      browser.relay.signedIn = false;
      const tab = openTab(browser);
      await start(tab);

      const result = tab.manager.signIn();
      tab.popup.state.closed = true;
      await vi.advanceTimersByTimeAsync(POPUP_POLL_MS);
      await expect(result).resolves.toBe('cancelled');
      finishPopup(browser, tab, false, 'access_denied');
      await flush();

      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'signed-out',
        error: null,
      });
    });

    it('stays signed out when the person signs out while the account is read', async () => {
      browser.relay.signedIn = false;
      const tab = openTab(browser);
      await start(tab);
      browser.relay.signedIn = true;
      const release = browser.relay.hold(USERINFO_URL);

      const result = tab.manager.signIn();
      finishPopup(browser, tab);
      await flush();
      expect(browser.relay.count(USERINFO_URL)).toBe(1);
      await tab.manager.signOut();
      release();

      await expect(result).resolves.toBe('cancelled');
      await flush();
      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'signed-out',
        account: null,
        error: null,
      });
    });

    it('closes a sign-in still open when the person signs out, and logs out again should it finish', async () => {
      const tab = openTab(browser);
      await start(tab);

      const result = tab.manager.signIn({ loginHint: 'sub-2' });
      await tab.manager.signOut();

      await expect(result).resolves.toBe('cancelled');
      expect(tab.popup.state.closeCalls).toBe(1);
      expect(browser.relay.signedIn).toBe(false);
      // Its callback was already under way and sets a cookie after the logout.
      browser.relay.account = { sub: 'sub-2', email: 'other@example.com' };
      browser.relay.signedIn = true;
      finishPopup(browser, tab);
      await flush();
      await flush();

      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'signed-out',
        signingIn: false,
        account: null,
      });
      expect(browser.relay.tokenCalls()).toBe(1);
      expect(browser.relay.count(RELAY_LOGOUT_PATH)).toBe(2);
      expect(browser.relay.signedIn).toBe(false);
      expect(browser.storage.items.has(LOGOUT_PENDING_KEY)).toBe(false);
      const next = openTab(browser);
      await start(next);
      expect(next.manager.getSnapshot().status).toBe('signed-out');
    });

    it('closes the sign-in another tab has open when one signs out', async () => {
      const first = openTab(browser);
      await start(first);
      const second = openTab(browser);
      await start(second);

      const result = second.manager.signIn({ loginHint: 'sub-2' });
      await first.manager.signOut();
      await flush();

      await expect(result).resolves.toBe('cancelled');
      expect(second.popup.state.closeCalls).toBe(1);
      browser.relay.signedIn = true;
      finishPopup(browser, second);
      await flush();
      await flush();

      expect(browser.relay.count(RELAY_LOGOUT_PATH)).toBe(2);
      expect(browser.relay.signedIn).toBe(false);
      expect(first.manager.getSnapshot().status).toBe('signed-out');
      expect(second.manager.getSnapshot()).toMatchObject({
        status: 'signed-out',
        signingIn: false,
      });
    });

    it('keeps the sign-in another tab has open when a renewal meets a revoked grant', async () => {
      const first = openTab(browser);
      await start(first);
      const second = openTab(browser);
      await start(second);
      const result = second.manager.signIn({ loginHint: 'sub-2' });
      browser.relay.queue(jsonReply({ error: 'invalid_grant' }, 401));

      const renewal = expect(
        first.manager.onUnauthorized('access-1')
      ).rejects.toMatchObject({ status: 'signed-out' });
      await vi.advanceTimersByTimeAsync(ADOPT_WAIT_MS);
      await renewal;
      await flush();
      expect(second.popup.state.closeCalls).toBe(0);
      expect(second.manager.getSnapshot()).toMatchObject({
        status: 'signed-out',
        signingIn: true,
        bySignOut: false,
      });

      browser.relay.account = { sub: 'sub-2', email: 'other@example.com' };
      finishPopup(browser, second);
      await flush();

      await expect(result).resolves.toBe('done');
      expect(second.manager.getSnapshot()).toMatchObject({
        status: 'server',
        account: { sub: 'sub-2' },
      });
    });

    it('keeps an account switch that finishes while a renewal for the old account is out', async () => {
      const tab = openTab(browser);
      await start(tab);
      const release = browser.relay.hold();

      const renewal = tab.manager.onUnauthorized('access-1');
      await vi.advanceTimersByTimeAsync(ADOPT_WAIT_MS);
      expect(browser.relay.tokenCalls()).toBe(2);
      const result = tab.manager.signIn({ loginHint: 'sub-2' });
      browser.relay.account = { sub: 'sub-2', email: 'other@example.com' };
      finishPopup(browser, tab);
      await flush();
      await expect(result).resolves.toBe('done');
      release();

      await expect(renewal).resolves.toBe('access-3');
      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'server',
        account: { sub: 'sub-2' },
      });
      expect(browser.relay.count(USERINFO_URL)).toBe(2);
    });

    it('asks the relay nothing once another tab switched accounts while it waited for a token', async () => {
      const first = openTab(browser);
      await start(first);
      const second = openTab(browser);
      await start(second);

      const renewal = expect(
        second.manager.onUnauthorized('access-1')
      ).rejects.toMatchObject({ status: 'account-changed' });
      void first.manager.signIn({ loginHint: 'sub-2' });
      browser.relay.account = { sub: 'sub-2', email: 'other@example.com' };
      finishPopup(browser, first);
      await vi.advanceTimersByTimeAsync(ADOPT_WAIT_MS);
      await renewal;

      expect(browser.relay.tokenCalls()).toBe(2);
      expect(first.manager.getSnapshot().account).toMatchObject({
        sub: 'sub-2',
      });
    });

    it('opens the relay popup again for Try again in the server mode', async () => {
      browser.relay.scope = NO_DRIVE;
      const tab = openTab(browser);
      await start(tab);
      browser.relay.scope = 'https://www.googleapis.com/auth/drive.file';

      void tab.manager.signIn();

      expect(tab.opened).toHaveLength(1);
      expect(tab.gis.requests).toHaveLength(0);
    });

    it('opens the relay popup for reconnect outside the fallback', async () => {
      browser.relay.signedIn = false;
      const tab = openTab(browser);
      await start(tab);

      void tab.manager.reconnect();

      expect(tab.opened).toHaveLength(1);
    });

    it('opens the token client for Sign in once another tab found the relay unavailable', async () => {
      browser.relay.signedIn = false;
      const tab = openTab(browser);
      await start(tab);
      browser.storage.setItem(UNAVAILABLE_UNTIL_KEY, String(MIDNIGHT));

      await expect(tab.manager.signIn()).resolves.toBe('unavailable');
      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'signed-out',
        mode: 'fallback',
      });
      await flush();
      void tab.manager.signIn();

      expect(tab.opened).toHaveLength(0);
      expect(tab.gis.requests).toEqual([{ prompt: 'select_account' }]);
      expect(browser.relay.relayCalls()).toBe(1);
    });

    it('follows another tab into the fallback when it shows again', async () => {
      browser.relay.signedIn = false;
      const tab = openTab(browser);
      await start(tab);
      browser.storage.setItem(UNAVAILABLE_UNTIL_KEY, String(MIDNIGHT));

      tab.doc.dispatchEvent(new Event('visibilitychange'));
      await flush();

      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'signed-out',
        mode: 'fallback',
        gis: 'ready',
      });
      expect(browser.relay.relayCalls()).toBe(1);
    });

    it('sends a new sign-in no pending logout, since its cookie replaced the old one', async () => {
      browser.relay.signedIn = false;
      const tab = openTab(browser);
      await start(tab);
      browser.storage.setItem(LOGOUT_PENDING_KEY, '1');
      browser.relay.signedIn = true;

      const result = tab.manager.signIn();
      finishPopup(browser, tab);
      await flush();

      await expect(result).resolves.toBe('done');
      expect(browser.relay.count(RELAY_LOGOUT_PATH)).toBe(0);
      expect(browser.storage.items.has(LOGOUT_PENDING_KEY)).toBe(false);
    });

    it('sends a pending logout before the token request of a popup closed unfinished', async () => {
      browser.relay.signedIn = false;
      const tab = openTab(browser);
      await start(tab);
      browser.storage.setItem(LOGOUT_PENDING_KEY, '1');
      // The cookie the failed logout left behind would sign the old account in.
      browser.relay.signedIn = true;

      const result = tab.manager.signIn();
      tab.manager.cancelSignIn();
      await flush();
      // A callback that crossed the close would report within the grace.
      expect(browser.relay.relayPaths()).toEqual([RELAY_TOKEN_PATH]);
      await vi.advanceTimersByTimeAsync(CALLBACK_GRACE_MS);

      await expect(result).resolves.toBe('cancelled');
      expect(browser.relay.relayPaths().slice(1)).toEqual([
        RELAY_LOGOUT_PATH,
        RELAY_TOKEN_PATH,
      ]);
      expect(tab.manager.getSnapshot().account).toBeNull();
    });

    it('keeps the cookie of a callback reporting just after the close, a logout pending', async () => {
      browser.relay.signedIn = false;
      const tab = openTab(browser);
      await start(tab);
      browser.storage.setItem(LOGOUT_PENDING_KEY, '1');
      // The callback replaced the cookie a failed logout left behind.
      browser.relay.signedIn = true;
      browser.relay.account = { sub: 'sub-2', email: 'other@example.com' };

      const result = tab.manager.signIn();
      tab.popup.state.closed = true;
      await vi.advanceTimersByTimeAsync(POPUP_POLL_MS);
      expect(browser.relay.relayPaths()).toEqual([RELAY_TOKEN_PATH]);
      finishPopup(browser, tab);
      await flush();

      await expect(result).resolves.toBe('done');
      expect(browser.relay.count(RELAY_LOGOUT_PATH)).toBe(0);
      expect(browser.storage.items.has(LOGOUT_PENDING_KEY)).toBe(false);
      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'server',
        account: { sub: 'sub-2' },
      });
    });
  });

  describe('the fallback', () => {
    async function fallenBack(tab: Tab) {
      browser.relay.queue(htmlReply(200));
      await start(tab);
      await flush();
    }

    async function signInWithGis(tab: Tab, expiresIn = 3599) {
      const result = tab.manager.signIn();
      tab.gis.respond(grant(browser, expiresIn));
      await flush();
      return result;
    }

    it.each([
      ['the app HTML with 200', () => htmlReply(200)],
      ['a 429', () => jsonReply({ error: 'rate_limited' }, 429)],
      ['a network error', () => 'network-error' as const],
    ])(
      'falls back on %s and records it until midnight',
      async (_label, reply) => {
        browser.relay.queue(reply());
        const tab = openTab(browser);

        await start(tab);
        await flush();

        expect(tab.manager.getSnapshot()).toMatchObject({
          status: 'signed-out',
          mode: 'fallback',
          gis: 'ready',
        });
        expect(browser.storage.items.get(UNAVAILABLE_UNTIL_KEY)).toBe(
          String(Date.UTC(2026, 8, 26))
        );
        expect(tab.gis.config()).toMatchObject({
          client_id: CLIENT_ID,
          scope:
            'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.install openid email',
        });
      }
    );

    it('sends the relay nothing more until the person signs out, then logs out there too', async () => {
      const tab = openTab(browser);
      await fallenBack(tab);
      expect(browser.relay.relayCalls()).toBe(1);

      await expect(signInWithGis(tab)).resolves.toBe('done');
      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'fallback',
        account: { sub: 'sub-1' },
      });

      // A second tab, a 401, a renewal on a click, the expiry and a reconnect.
      const second = openTab(browser);
      await start(second);
      await expect(second.manager.getAccessToken()).resolves.toBe('access-1');
      await vi.advanceTimersByTimeAsync(3599 * 1000 - REFRESH_MARGIN_MS);
      expect(tab.manager.getSnapshot().renewDue).toBe(true);
      click(tab, document.createElement('button'));
      expect(tab.gis.requests.at(-1)).toEqual({
        prompt: '',
        login_hint: 'sub-1',
      });
      tab.gis.respond(grant(browser));
      await flush();
      await expect(tab.manager.getAccessToken()).resolves.toBe('access-2');
      await expect(
        tab.manager.onUnauthorized('access-2')
      ).rejects.toMatchObject({
        status: 'fallback-expired',
      });
      void tab.manager.reconnect();
      tab.gis.respond(grant(browser));
      await flush();
      await vi.advanceTimersByTimeAsync(HOUR);
      expect(tab.manager.getSnapshot().status).toBe('fallback-expired');
      expect(browser.relay.relayCalls()).toBe(1);
      expect(tab.opened).toHaveLength(0);

      await tab.manager.signOut();

      expect(browser.relay.count(RELAY_LOGOUT_PATH)).toBe(1);
      expect(browser.relay.count(RELAY_TOKEN_PATH)).toBe(1);
    });

    it('lets a tab opened in the fallback take another tab’s token without the relay', async () => {
      const first = openTab(browser);
      await fallenBack(first);
      await signInWithGis(first);
      const second = openTab(browser);

      await start(second);

      expect(second.manager.getSnapshot()).toMatchObject({
        status: 'fallback',
        mode: 'fallback',
      });
      expect(browser.relay.relayCalls()).toBe(1);
    });

    it('is signed out in the fallback when no tab has a token', async () => {
      const first = openTab(browser);
      await fallenBack(first);
      const second = openTab(browser);

      await start(second);

      expect(second.manager.getSnapshot()).toMatchObject({
        status: 'signed-out',
        mode: 'fallback',
      });
      expect(browser.relay.relayCalls()).toBe(1);
    });

    it('asks for an account on sign-in and uses a login hint when given', async () => {
      const tab = openTab(browser);
      await fallenBack(tab);

      void tab.manager.signIn();
      expect(tab.gis.requests).toEqual([{ prompt: 'select_account' }]);
      tab.gis.fail('popup_closed');
      await flush();

      void tab.manager.signIn({ loginHint: 'sub-9' });
      expect(tab.gis.requests.at(-1)).toEqual({
        prompt: '',
        login_hint: 'sub-9',
      });
    });

    it.each([
      ['popup_failed_to_open', 'blocked', 'popup-blocked'],
      ['popup_closed', 'cancelled', null],
      ['unknown', 'error', 'failed'],
    ] as const)(
      'reads the token client failing with %s as %s',
      async (type, result, error) => {
        const tab = openTab(browser);
        await fallenBack(tab);

        const signIn = tab.manager.signIn();
        tab.gis.fail(type);

        await expect(signIn).resolves.toBe(result);
        expect(tab.manager.getSnapshot()).toMatchObject({
          signingIn: false,
          error,
        });
      }
    );

    it.each([
      [{ error: 'access_denied' }, 'cancelled'],
      [{ error: 'invalid_request' }, 'error'],
      [{ expires_in: 3599 }, 'error'],
      [{ access_token: 'x', expires_in: 0 }, 'error'],
    ])(
      'reads the token client answering %j as %s',
      async (response, result) => {
        const tab = openTab(browser);
        await fallenBack(tab);

        const signIn = tab.manager.signIn();
        tab.gis.respond(response);

        await expect(signIn).resolves.toBe(result);
      }
    );

    it('stops for a token client grant without drive.file, and Try again opens the token client', async () => {
      const tab = openTab(browser);
      await fallenBack(tab);

      const signIn = tab.manager.signIn();
      tab.gis.respond(grant(browser, 3599, NO_DRIVE));

      await expect(signIn).resolves.toBe('scope-missing');
      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'scope-missing',
        mode: 'fallback',
      });

      void tab.manager.signIn();
      expect(tab.gis.requests).toHaveLength(2);
      expect(tab.opened).toHaveLength(0);
    });

    it('takes the token client answer with a lifetime as text', async () => {
      const tab = openTab(browser);
      await fallenBack(tab);

      const signIn = tab.manager.signIn();
      tab.gis.respond({ ...grant(browser), expires_in: '3599' });

      await expect(signIn).resolves.toBe('done');
    });

    it('does not renew on a gesture that may be typing', async () => {
      const tab = openTab(browser);
      await fallenBack(tab);
      await signInWithGis(tab);
      await vi.advanceTimersByTimeAsync(3599 * 1000 - REFRESH_MARGIN_MS);
      expect(tab.manager.getSnapshot().renewDue).toBe(true);

      const keyup = (target: EventTarget) =>
        tab.events.dispatchEvent(
          Object.defineProperty(new KeyboardEvent('keyup'), 'composedPath', {
            value: () => [target, tab.events],
          })
        );
      click(tab, document.createElement('input'));
      keyup(document.createElement('textarea'));
      keyup(document.createElement('erd-editor'));
      click(tab, document.createElement('erd-editor'));
      expect(tab.gis.requests).toHaveLength(1);

      click(tab, document.createElement('button'));
      expect(tab.gis.requests).toEqual([
        { prompt: 'select_account' },
        { prompt: '', login_hint: 'sub-1' },
      ]);
    });

    it('does not renew before the token is due, or twice at once', async () => {
      const tab = openTab(browser);
      await fallenBack(tab);
      await signInWithGis(tab);

      click(tab, document.createElement('button'));
      expect(tab.gis.requests).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(3599 * 1000 - REFRESH_MARGIN_MS);
      click(tab, document.createElement('button'));
      click(tab, document.createElement('button'));
      const reconnect = tab.manager.reconnect();

      expect(tab.gis.requests).toHaveLength(2);
      tab.gis.respond(grant(browser));
      await expect(reconnect).resolves.toBe('done');
    });

    it('stops renewing on gestures after one failed, until Reconnect Google', async () => {
      const tab = openTab(browser);
      await fallenBack(tab);
      await signInWithGis(tab);
      await vi.advanceTimersByTimeAsync(3599 * 1000 - REFRESH_MARGIN_MS);

      click(tab, document.createElement('button'));
      tab.gis.fail('popup_failed_to_open');
      await flush();
      expect(tab.manager.getSnapshot().error).toBeNull();
      click(tab, document.createElement('button'));
      expect(tab.gis.requests).toHaveLength(2);

      void tab.manager.reconnect();
      expect(tab.gis.requests).toHaveLength(3);
      tab.gis.respond(grant(browser));
      await flush();
      click(tab, document.createElement('button'));
      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'fallback',
        renewDue: false,
      });
    });

    it('expires into Reconnect Google, which uses the token client alone', async () => {
      const tab = openTab(browser);
      await fallenBack(tab);
      await signInWithGis(tab);

      await vi.advanceTimersByTimeAsync(3599 * 1000);

      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'fallback-expired',
        renewDue: true,
        account: { sub: 'sub-1' },
      });
      await expect(tab.manager.getAccessToken()).rejects.toMatchObject({
        status: 'fallback-expired',
      });

      const reconnect = tab.manager.reconnect();
      expect(tab.gis.requests.at(-1)).toEqual({
        prompt: '',
        login_hint: 'sub-1',
      });
      tab.gis.respond(grant(browser));
      await expect(reconnect).resolves.toBe('done');
      expect(tab.opened).toHaveLength(0);
      expect(browser.relay.relayCalls()).toBe(1);
    });

    it('reports a blocked Reconnect Google whose click started a renewal first', async () => {
      const tab = openTab(browser);
      await fallenBack(tab);
      await signInWithGis(tab);
      await vi.advanceTimersByTimeAsync(3599 * 1000);
      expect(tab.manager.getSnapshot().renewDue).toBe(true);

      // The window's capture listener sees the click before the button's handler.
      click(tab, document.createElement('button'));
      const reconnect = tab.manager.reconnect();
      tab.gis.fail('popup_failed_to_open');

      await expect(reconnect).resolves.toBe('blocked');
      expect(tab.gis.requests).toHaveLength(2);
      expect(tab.manager.getSnapshot()).toMatchObject({
        signingIn: false,
        error: 'popup-blocked',
      });
      click(tab, document.createElement('button'));
      expect(tab.gis.requests).toHaveLength(3);
    });

    it('leaves a click on a sign-in or sign-out control to its own handler', async () => {
      const tab = openTab(browser);
      await fallenBack(tab);
      await signInWithGis(tab);
      await vi.advanceTimersByTimeAsync(3599 * 1000 - REFRESH_MARGIN_MS);
      const signOutButton = document.createElement('button');
      signOutButton.setAttribute(AUTH_CONTROL_ATTRIBUTE, '');

      click(tab, signOutButton);
      await tab.manager.signOut();

      expect(tab.gis.requests).toHaveLength(1);
    });

    it('renews on gestures again after signing out and in', async () => {
      const tab = openTab(browser);
      await fallenBack(tab);
      await signInWithGis(tab);
      await vi.advanceTimersByTimeAsync(3599 * 1000 - REFRESH_MARGIN_MS);
      click(tab, document.createElement('button'));
      await tab.manager.signOut();
      await flush();

      await expect(signInWithGis(tab)).resolves.toBe('done');
      await vi.advanceTimersByTimeAsync(3599 * 1000 - REFRESH_MARGIN_MS);
      click(tab, document.createElement('button'));

      expect(tab.gis.requests).toEqual([
        { prompt: 'select_account' },
        { prompt: '', login_hint: 'sub-1' },
        { prompt: 'select_account' },
        { prompt: '', login_hint: 'sub-1' },
      ]);
    });

    it('renews on gestures again once a new token came after one failed', async () => {
      const tab = openTab(browser);
      await fallenBack(tab);
      await signInWithGis(tab);
      await vi.advanceTimersByTimeAsync(3599 * 1000 - REFRESH_MARGIN_MS);
      click(tab, document.createElement('button'));
      tab.gis.fail('popup_closed');
      await flush();

      const signIn = tab.manager.signIn({ loginHint: 'sub-1' });
      tab.gis.respond(grant(browser));
      await expect(signIn).resolves.toBe('done');
      await vi.advanceTimersByTimeAsync(3599 * 1000 - REFRESH_MARGIN_MS);
      click(tab, document.createElement('button'));

      expect(tab.gis.requests).toHaveLength(4);
    });

    it.each([
      [
        'signs in with the cookie the fallback kept',
        true,
        'done',
        { status: 'server', mode: 'server', account: { sub: 'sub-1' } },
      ],
      [
        'leaves Sign in on a 401',
        false,
        'cancelled',
        { status: 'signed-out', mode: 'server', account: null },
      ],
    ] as const)(
      'asks the relay once, opening no popup, for Reconnect Google past midnight: %s',
      async (_label, signedIn, expected, snapshot) => {
        const tab = openTab(browser);
        vi.setSystemTime(Date.UTC(2026, 8, 25, 22));
        await fallenBack(tab);
        await signInWithGis(tab);
        await vi.advanceTimersByTimeAsync(3599 * 1000);
        expect(tab.manager.getSnapshot().status).toBe('fallback-expired');
        vi.setSystemTime(MIDNIGHT + HOUR / 2);
        browser.relay.signedIn = signedIn;

        const reconnect = tab.manager.reconnect();
        await vi.advanceTimersByTimeAsync(ADOPT_WAIT_MS);

        await expect(reconnect).resolves.toBe(expected);
        expect(browser.relay.tokenCalls()).toBe(2);
        expect(tab.opened).toHaveLength(0);
        expect(tab.gis.requests).toHaveLength(1);
        expect(tab.manager.getSnapshot()).toMatchObject(snapshot);
      }
    );

    it('reports the relay still unavailable to Reconnect Google past midnight', async () => {
      const tab = openTab(browser);
      vi.setSystemTime(Date.UTC(2026, 8, 25, 22));
      await fallenBack(tab);
      await signInWithGis(tab);
      await vi.advanceTimersByTimeAsync(3599 * 1000);
      vi.setSystemTime(MIDNIGHT + HOUR / 2);
      browser.relay.queue(htmlReply(200));

      const reconnect = tab.manager.reconnect();
      await vi.advanceTimersByTimeAsync(ADOPT_WAIT_MS);

      await expect(reconnect).resolves.toBe('unavailable');
      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'fallback-expired',
        mode: 'fallback',
      });
      void tab.manager.reconnect();
      expect(tab.gis.requests).toHaveLength(2);
    });

    it.each([
      [
        'shows again',
        (tab: Tab) => tab.doc.dispatchEvent(new Event('visibilitychange')),
      ],
      [
        'gets a click',
        (tab: Tab) => click(tab, document.createElement('button')),
      ],
    ])(
      'asks the relay first once an expired tab %s past midnight',
      async (_label, act) => {
        const tab = openTab(browser);
        vi.setSystemTime(Date.UTC(2026, 8, 25, 22));
        await fallenBack(tab);
        await signInWithGis(tab);
        await vi.advanceTimersByTimeAsync(3599 * 1000);
        vi.setSystemTime(MIDNIGHT + HOUR / 2);

        act(tab);
        await vi.advanceTimersByTimeAsync(ADOPT_WAIT_MS);

        expect(browser.relay.relayCalls()).toBe(2);
        expect(tab.gis.requests).toHaveLength(1);
        expect(tab.manager.getSnapshot()).toMatchObject({
          status: 'server',
          mode: 'server',
          account: { sub: 'sub-1' },
        });
      }
    );

    it('marks a token past its end expired when a Drive call asks for it', async () => {
      const tab = openTab(browser);
      await fallenBack(tab);
      await signInWithGis(tab);
      vi.setSystemTime(Date.now() + HOUR);

      await expect(tab.manager.getAccessToken()).rejects.toMatchObject({
        status: 'fallback-expired',
      });
    });

    it('tries the relay first again once midnight has passed', async () => {
      const tab = openTab(browser);
      vi.setSystemTime(Date.UTC(2026, 8, 25, 23, 30));
      await fallenBack(tab);
      await signInWithGis(tab);

      await vi.advanceTimersByTimeAsync(3599 * 1000 + ADOPT_WAIT_MS);

      expect(browser.relay.relayCalls()).toBe(2);
      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'server',
        mode: 'server',
      });
    });

    it('keeps a live relay token after a renewal finds the relay unavailable', async () => {
      const tab = openTab(browser);
      await start(tab);
      browser.relay.queue(jsonReply({ error: 'x' }, 503));

      await vi.advanceTimersByTimeAsync(
        3600 * 1000 - REFRESH_MARGIN_MS + ADOPT_WAIT_MS
      );

      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'fallback',
        mode: 'fallback',
        renewDue: true,
      });
      await expect(tab.manager.getAccessToken()).resolves.toBe('access-1');
      await vi.advanceTimersByTimeAsync(REFRESH_MARGIN_MS);
      expect(tab.manager.getSnapshot().status).toBe('fallback-expired');
      expect(browser.relay.tokenCalls()).toBe(2);
    });

    it('leaves the relay alone at renewal once another tab found it unavailable', async () => {
      const tab = openTab(browser);
      await start(tab);
      browser.storage.setItem(
        UNAVAILABLE_UNTIL_KEY,
        String(Date.UTC(2026, 8, 26))
      );

      await vi.advanceTimersByTimeAsync(
        3600 * 1000 - REFRESH_MARGIN_MS + ADOPT_WAIT_MS
      );

      expect(browser.relay.tokenCalls()).toBe(1);
      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'fallback',
        mode: 'fallback',
        renewDue: true,
        gis: 'ready',
      });
      await expect(
        tab.manager.onUnauthorized('access-1')
      ).rejects.toMatchObject({ status: 'fallback-expired' });
      expect(browser.relay.tokenCalls()).toBe(1);
    });

    it('drops a token client answer that comes after signing out', async () => {
      const tab = openTab(browser);
      await fallenBack(tab);
      await signInWithGis(tab);
      await vi.advanceTimersByTimeAsync(3599 * 1000);

      const reconnect = tab.manager.reconnect();
      await tab.manager.signOut();
      tab.gis.respond(grant(browser));
      await flush();

      await expect(reconnect).resolves.toBe('cancelled');
      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'signed-out',
        signingIn: false,
      });
    });

    it.each([
      ['after it hears of the sign-out', true],
      ['before it hears of the sign-out', false],
    ])(
      'drops a renewal another tab asked for before the sign-out, answered %s',
      async (_label, heard) => {
        const first = openTab(browser);
        await fallenBack(first);
        await signInWithGis(first);
        const second = openTab(browser);
        await start(second);
        await vi.advanceTimersByTimeAsync(3599 * 1000 - REFRESH_MARGIN_MS);
        click(second, document.createElement('button'));
        expect(second.gis.requests).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(1000);

        await first.manager.signOut();
        if (heard) await flush();
        second.gis.respond(grant(browser));
        await flush();
        await flush();

        for (const tab of [first, second]) {
          expect(tab.manager.getSnapshot()).toMatchObject({
            status: 'signed-out',
            account: null,
          });
          await expect(tab.manager.getAccessToken()).rejects.toBeInstanceOf(
            TokenUnavailableError
          );
        }
      }
    );

    it('revokes the token client grant on sign out', async () => {
      const tab = openTab(browser);
      await fallenBack(tab);
      await signInWithGis(tab);

      await tab.manager.signOut();

      expect(tab.gis.revoked).toEqual(['access-1']);
      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'signed-out',
        mode: 'fallback',
        account: null,
      });
    });

    it('still logs out at the relay when revoking throws', async () => {
      const tab = openTab(browser);
      await fallenBack(tab);
      await signInWithGis(tab);
      tab.gis.oauth2.revoke = () => {
        throw new Error('gone');
      };

      await tab.manager.signOut();

      expect(browser.relay.count(RELAY_LOGOUT_PATH)).toBe(1);
    });

    it('leaves the logout pending when the relay cannot confirm it, then sends it before the next token request', async () => {
      const tab = openTab(browser);
      vi.setSystemTime(Date.UTC(2026, 8, 25, 22));
      await fallenBack(tab);
      await signInWithGis(tab);
      await vi.advanceTimersByTimeAsync(3599 * 1000);
      expect(tab.manager.getSnapshot().status).toBe('fallback-expired');
      browser.relay.queueLogout(htmlReply(403));

      await expect(tab.manager.signOut()).resolves.toBe(false);

      expect(browser.storage.items.has(LOGOUT_PENDING_KEY)).toBe(true);
      expect(browser.relay.signedIn).toBe(true);
      tab.manager.dispose();

      // The next visit, past midnight: the logout first, and nobody is signed in.
      vi.setSystemTime(MIDNIGHT + HOUR);
      const next = openTab(browser);
      await start(next);

      expect(browser.relay.relayPaths()).toEqual([
        RELAY_TOKEN_PATH,
        RELAY_LOGOUT_PATH,
        RELAY_LOGOUT_PATH,
        RELAY_TOKEN_PATH,
      ]);
      expect(next.manager.getSnapshot()).toMatchObject({
        status: 'signed-out',
        mode: 'server',
        account: null,
      });
      expect(browser.storage.items.has(LOGOUT_PENDING_KEY)).toBe(false);
    });

    it('asks for no token while the pending logout keeps failing', async () => {
      browser.storage.setItem(LOGOUT_PENDING_KEY, '1');
      browser.relay.queueLogout('network-error');
      const tab = openTab(browser);

      await start(tab);
      await flush();

      expect(browser.relay.relayPaths()).toEqual([RELAY_LOGOUT_PATH]);
      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'signed-out',
        mode: 'fallback',
      });
      expect(browser.storage.items.has(LOGOUT_PENDING_KEY)).toBe(true);
    });

    it('holds its judgement on a pending logout while offline', async () => {
      browser.storage.setItem(LOGOUT_PENDING_KEY, '1');
      browser.relay.queueLogout('network-error');
      browser.online = false;
      const tab = openTab(browser);

      await start(tab);

      expect(tab.manager.getSnapshot().status).toBe('offline');
      expect(browser.relay.tokenCalls()).toBe(0);
    });

    it('shows the token client as blocked when its script cannot load', async () => {
      browser.relay.queue(htmlReply(200));
      const tab = openTab(browser, {
        loadGis: () => Promise.reject(new GisBlockedError()),
      });

      await start(tab);
      await flush();

      expect(tab.manager.getSnapshot()).toMatchObject({
        mode: 'fallback',
        gis: 'blocked',
      });
      await expect(tab.manager.signIn()).resolves.toBe('error');
      await flush();
      expect(tab.manager.getSnapshot().gis).toBe('blocked');
    });
  });

  describe('the shared channel', () => {
    it('ignores a token that is older, expired, without drive.file or malformed', async () => {
      const tab = openTab(browser);
      await start(tab);
      const session = {
        accessToken: 'stranger',
        issuedAt: Date.now(),
        expiresAt: Date.now() + HOUR * 2,
        renewAt: Date.now() + HOUR,
        scope: null,
        account: { sub: 'sub-1', email: 'person@example.com' },
        mode: 'server',
      };

      for (const message of [
        {
          type: 'token',
          session: { ...session, expiresAt: Date.now() + 1000 },
        },
        { type: 'token', session: { ...session, expiresAt: Date.now() - 1 } },
        { type: 'token', session: { ...session, scope: NO_DRIVE } },
        { type: 'token', session: { ...session, mode: 'other' } },
        { type: 'token', session: { ...session, account: null } },
        { type: 'token', session: { ...session, issuedAt: undefined } },
        { type: 'token' },
        { type: 'unknown' },
        'token',
      ]) {
        browser.hub.broadcast(TOKEN_CHANNEL, message);
      }
      await flush();
      await expect(tab.manager.getAccessToken()).resolves.toBe('access-1');

      browser.hub.broadcast(TOKEN_CHANNEL, { type: 'token', session });
      await flush();
      await expect(tab.manager.getAccessToken()).resolves.toBe('stranger');
    });

    it('does not answer a request with an expired token', async () => {
      const tab = openTab(browser);
      await start(tab);
      vi.setSystemTime(Date.now() + HOUR * 2);
      const before = browser.hub.posted.length;

      browser.hub.broadcast(TOKEN_CHANNEL, { type: 'request' });
      await flush();

      expect(browser.hub.posted.length).toBe(before + 1);
    });

    it('stays signed out when another tab signs out before it had an account', async () => {
      browser.relay.signedIn = false;
      const tab = openTab(browser);
      await start(tab);
      const listener = vi.fn();
      tab.manager.subscribe(listener);

      browser.hub.broadcast(TOKEN_CHANNEL, { type: 'signed-out' });
      await flush();

      expect(listener).not.toHaveBeenCalled();
    });

    it('learns that a person signed out elsewhere after a 401 had signed it out', async () => {
      browser.relay.signedIn = false;
      const tab = openTab(browser);
      await start(tab);
      expect(tab.manager.getSnapshot().bySignOut).toBe(false);

      browser.hub.broadcast(TOKEN_CHANNEL, {
        type: 'signed-out',
        at: 1,
        fromSignOut: true,
      });
      await flush();

      expect(tab.manager.getSnapshot()).toMatchObject({
        status: 'signed-out',
        bySignOut: true,
      });
    });

    it('signs every tab out from one, logging out at the relay', async () => {
      const first = openTab(browser);
      await start(first);
      const second = openTab(browser);
      await start(second);

      await expect(first.manager.signOut()).resolves.toBe(true);
      await flush();

      expect(first.manager.getSnapshot().bySignOut).toBe(true);
      expect(second.manager.getSnapshot()).toMatchObject({
        status: 'signed-out',
        account: null,
        bySignOut: true,
      });
      expect(browser.relay.count(RELAY_LOGOUT_PATH)).toBe(1);
      expect(first.gis.revoked).toEqual([]);
      expect(browser.relay.revoked).toEqual([]);
      expect(browser.storage.items.has(LOGOUT_PENDING_KEY)).toBe(false);
    });

    it('revokes a live token at Google itself when the logout meets a network error', async () => {
      const first = openTab(browser);
      await start(first);
      browser.relay.queueLogout('network-error');

      await expect(first.manager.signOut()).resolves.toBe(false);

      expect(browser.relay.revoked).toEqual(['access-1']);
      expect(browser.storage.items.has(LOGOUT_PENDING_KEY)).toBe(true);
      const second = openTab(browser);
      await start(second);
      expect(browser.relay.relayPaths().slice(-2)).toEqual([
        RELAY_LOGOUT_PATH,
        RELAY_TOKEN_PATH,
      ]);
      expect(second.manager.getSnapshot()).toMatchObject({
        status: 'signed-out',
        account: null,
      });
      expect(browser.storage.items.has(LOGOUT_PENDING_KEY)).toBe(false);
    });

    it('ignores a token another tab sent before it heard of the sign-out', async () => {
      const first = openTab(browser);
      await start(first);
      const second = openTab(browser);
      await start(second);
      await vi.advanceTimersByTimeAsync(1000);

      // A third tab asks; the second answers, and the first signs out before that answer lands.
      browser.hub.broadcast(TOKEN_CHANNEL, { type: 'request' });
      await vi.advanceTimersByTimeAsync(0);
      await first.manager.signOut();
      await flush();

      expect(first.manager.getSnapshot()).toMatchObject({
        status: 'signed-out',
        account: null,
      });
      await expect(first.manager.getAccessToken()).rejects.toBeInstanceOf(
        TokenUnavailableError
      );
      expect(second.manager.getSnapshot().status).toBe('signed-out');
    });

    it('drops its own renewal when another tab signs out while the relay answers', async () => {
      const first = openTab(browser);
      await start(first);
      const second = openTab(browser);
      await start(second);
      const release = browser.relay.hold();

      const renewal = expect(
        second.manager.onUnauthorized('access-1')
      ).rejects.toMatchObject({ status: 'signed-out' });
      await vi.advanceTimersByTimeAsync(ADOPT_WAIT_MS);
      expect(browser.relay.tokenCalls()).toBe(2);
      await first.manager.signOut();
      await flush();
      release();
      await renewal;
      await flush();

      expect(second.manager.getSnapshot()).toMatchObject({
        status: 'signed-out',
        account: null,
      });
      expect(first.manager.getSnapshot().status).toBe('signed-out');
      expect(browser.relay.count(USERINFO_URL)).toBe(1);
    });

    it('renews without locks, as where the browser has none', async () => {
      const manager = createTokenManager({
        fetch: browser.relay.fetch,
        clientId: CLIENT_ID,
        createChannel: browser.hub.create,
        locks: null,
        storage: null,
        loadGis: createFakeGis().load,
        openWindow: () => null,
        events: new EventTarget(),
        document: Object.assign(new EventTarget(), {
          visibilityState: 'visible' as const,
        }),
      });

      const started = manager.start();
      await vi.advanceTimersByTimeAsync(ADOPT_WAIT_MS);
      await started;
      expect(manager.getSnapshot().status).toBe('server');

      await vi.advanceTimersByTimeAsync(
        3600 * 1000 - REFRESH_MARGIN_MS + ADOPT_WAIT_MS
      );

      expect(browser.relay.tokenCalls()).toBe(2);
      await expect(manager.getAccessToken()).resolves.toBe('access-2');
      manager.dispose();
    });
  });

  it('starts once and stops listening on dispose', async () => {
    const tab = openTab(browser);
    const listener = vi.fn();
    const unsubscribe = tab.manager.subscribe(listener);

    const started = tab.manager.start();
    expect(tab.manager.start()).toBe(started);
    await vi.advanceTimersByTimeAsync(ADOPT_WAIT_MS);
    await started;
    expect(listener).toHaveBeenCalled();
    expect(browser.hub.openCount(TOKEN_CHANNEL)).toBe(1);

    unsubscribe();
    listener.mockClear();
    tab.manager.reportInsufficientScope();
    expect(listener).not.toHaveBeenCalled();

    tab.manager.dispose();
    expect(browser.hub.openCount(TOKEN_CHANNEL)).toBe(0);
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(browser.relay.tokenCalls()).toBe(1);
  });

  it('asks the relay nothing once disposed while it waited for the other tabs', async () => {
    const tab = openTab(browser);

    const started = tab.manager.start();
    tab.manager.dispose();
    await vi.advanceTimersByTimeAsync(ADOPT_WAIT_MS);
    await started;

    expect(browser.relay.tokenCalls()).toBe(0);
  });

  it('leaves no timer behind for a token that lands after dispose', async () => {
    let release: () => void = () => {};
    let asked = false;
    const gate = new Promise<void>(resolve => (release = resolve));
    const relayFetch = browser.relay.fetch;
    const manager = createTokenManager({
      fetch: receiverChecked(async (url, init) => {
        if (url === RELAY_TOKEN_PATH) {
          asked = true;
          await gate;
        }
        return relayFetch(url, init);
      }),
      clientId: CLIENT_ID,
      createChannel: browser.hub.create,
      locks: browser.locks,
      storage: browser.storage,
      loadGis: createFakeGis().load,
      openWindow: () => null,
      events: new EventTarget(),
      document: Object.assign(new EventTarget(), {
        visibilityState: 'visible' as const,
      }),
    });

    const started = manager.start();
    await vi.advanceTimersByTimeAsync(ADOPT_WAIT_MS);
    await flush();
    expect(asked).toBe(true);
    manager.dispose();
    release();
    await started;

    expect(browser.relay.tokenCalls()).toBe(1);
    expect(manager.getSnapshot().status).toBe('server');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps a throwing listener from stopping the others', async () => {
    const tab = openTab(browser);
    const second = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    tab.manager.subscribe(() => {
      throw new Error('boom');
    });
    tab.manager.subscribe(second);

    await start(tab);

    expect(second).toHaveBeenCalled();
  });
});

describe('isEditingGesture', () => {
  const gesture = (...path: unknown[]) =>
    ({ composedPath: () => path }) as unknown as Event;

  it.each([
    ['an input', { tagName: 'INPUT' }],
    ['a textarea', { tagName: 'TEXTAREA' }],
    ['a select', { tagName: 'SELECT' }],
    ['a contenteditable element', { tagName: 'DIV', isContentEditable: true }],
    // What Chrome gives a window listener for a column name typed inside the
    // editor: its closed shadow root hides the input, leaving the host.
    ['the erd-editor host', { tagName: 'ERD-EDITOR' }],
  ])('holds a gesture on %s', (_label, target) => {
    expect(isEditingGesture(gesture(target, { tagName: 'BODY' }, window))).toBe(
      true
    );
  });

  it('lets a gesture on a button through', () => {
    expect(
      isEditingGesture(
        gesture({ tagName: 'BUTTON' }, { tagName: 'BODY' }, window)
      )
    ).toBe(false);
  });

  it('reads a real composed path through a shadow root', () => {
    const host = document.createElement('div');
    const input = document.createElement('input');
    host.attachShadow({ mode: 'open' }).append(input);
    document.body.append(host);
    let editing: boolean | null = null;
    const listener = (event: Event) => {
      editing = isEditingGesture(event);
    };
    window.addEventListener('click', listener, true);

    input.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true })
    );

    window.removeEventListener('click', listener, true);
    host.remove();
    expect(editing).toBe(true);
  });
});

describe('isAuthControlGesture', () => {
  it('reads a click inside a marked control as one, and any other click not', () => {
    const control = document.createElement('button');
    control.setAttribute(AUTH_CONTROL_ATTRIBUTE, '');
    const icon = document.createElement('span');
    control.append(icon);
    document.body.append(control);
    const seen: boolean[] = [];
    const listener = (event: Event) => seen.push(isAuthControlGesture(event));
    window.addEventListener('click', listener, true);

    icon.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    window.removeEventListener('click', listener, true);
    control.remove();
    expect(seen).toEqual([true, false]);
  });
});

describe('lacksDriveScope', () => {
  it('reads a scope that names no drive.file as missing it, and no scope as unknown', () => {
    expect(lacksDriveScope(NO_DRIVE)).toBe(true);
    expect(
      lacksDriveScope('https://www.googleapis.com/auth/drive.file openid')
    ).toBe(false);
    expect(lacksDriveScope('')).toBe(false);
    expect(lacksDriveScope(null)).toBe(false);
  });
});

describe('fetchUserInfo', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads sub and email with the bearer token, calling fetch without a receiver', async () => {
    const relay = createFakeRelay();
    const token = relay.issue();

    await expect(fetchUserInfo(relay.fetch, token)).resolves.toEqual({
      sub: 'sub-1',
      email: 'person@example.com',
    });
  });

  it.each([
    ['a 401', () => jsonReply({ error: 'invalid_token' }, 401)],
    ['an answer without sub', () => jsonReply({ email: 'a@b.c' })],
    ['an answer that is no object', () => jsonReply('sub')],
  ])('fails on %s', async (_label, reply) => {
    await expect(fetchUserInfo(async () => reply(), 'token')).rejects.toThrow(
      'Google userinfo failed'
    );
  });

  it('gives up after the timeout', async () => {
    vi.useFakeTimers();
    const relay = createFakeRelay();
    relay.stallUserInfo();

    const account = expect(
      fetchUserInfo(relay.fetch, relay.issue())
    ).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(RELAY_TIMEOUT_MS);

    await account;
  });
});

describe('revokeAtGoogle', () => {
  it('POSTs the token as a form, calling fetch without a receiver', async () => {
    const relay = createFakeRelay();

    await revokeAtGoogle(relay.fetch, 'access-9');

    expect(relay.revoked).toEqual(['access-9']);
    expect(relay.count(GOOGLE_REVOKE_URL)).toBe(1);
  });

  it('settles quietly on a network error', async () => {
    await expect(
      revokeAtGoogle(
        receiverChecked(() => Promise.reject(new TypeError('failed'))),
        'access-9'
      )
    ).resolves.toBeUndefined();
  });
});
