import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { createChannelHub, createFakePopup } from '@/__test-utils__/gdrive';
import { AUTH_CHANNEL } from '@/server/auth/callbackPage';
import type { RelayTokenResult } from '@/services/gdrive/authMode';
import {
  CALLBACK_GRACE_MS,
  type OAuthPopup,
  type OAuthPopupDeps,
  type OAuthPopupOutcome,
  openOAuthPopup,
  POPUP_FEATURES,
  POPUP_NAME,
  POPUP_POLL_MS,
  POPUP_TIMEOUT_MS,
  type PopupWindowLike,
} from '@/services/gdrive/oauthPopup';

const ATTEMPT = 'AbCdEfGhIjKlMnOpQrStUv';
const TOKEN = { accessToken: 'ya29.a', expiresIn: 3599, scope: 'openid' };
const TOKEN_RESULT: RelayTokenResult = { kind: 'token', token: TOKEN };

function setup({
  blocked = false,
  requestTokenWith,
}: {
  blocked?: boolean;
  requestTokenWith?: OAuthPopupDeps['requestToken'];
} = {}) {
  const hub = createChannelHub();
  const popup = createFakePopup();
  const opened: Array<{ url: string; target: string; features: string }> = [];
  const tokenResults: RelayTokenResult[] = [];
  const requestToken = vi.fn<OAuthPopupDeps['requestToken']>(
    async () => tokenResults.shift() ?? { kind: 'signed-out' }
  );
  const recordUnavailable = vi.fn();
  const onLate = vi.fn();

  // window.open throws when called through another object, as in Chrome.
  const open = function (
    this: unknown,
    url: string,
    target: string,
    features: string
  ): PopupWindowLike | null {
    if (this !== undefined && this !== globalThis) {
      throw new TypeError('Illegal invocation');
    }
    opened.push({ url, target, features });
    return blocked ? null : popup.window;
  };

  const start = (loginHint: string | null = null) =>
    openOAuthPopup(
      {
        open,
        createChannel: hub.create,
        requestToken: requestTokenWith ?? requestToken,
        recordUnavailable,
        createAttempt: () => ATTEMPT,
      },
      { loginHint, onLate }
    );

  const done = (message: Record<string, unknown>) =>
    hub.broadcast(AUTH_CHANNEL, { type: 'oauth-done', ...message });

  return {
    hub,
    popup,
    opened,
    tokenResults,
    requestToken,
    recordUnavailable,
    onLate,
    start,
    done,
  };
}

async function settle(result: Promise<OAuthPopupOutcome>) {
  const outcome = vi.fn();
  void result.then(outcome);
  await vi.advanceTimersByTimeAsync(0);
  return outcome;
}

describe('openOAuthPopup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens the relay start with the attempt, as a named popup', () => {
    const { opened, start } = setup();

    start();

    expect(opened).toEqual([
      {
        url: `/api/auth/start?attempt=${ATTEMPT}`,
        target: POPUP_NAME,
        features: POPUP_FEATURES,
      },
    ]);
  });

  it('adds the login hint of an account switch', () => {
    const { opened, start } = setup();

    start('1234567890');

    expect(
      new URL(opened[0].url, 'https://erd-editor.io').searchParams.get(
        'login_hint'
      )
    ).toBe('1234567890');
  });

  it('makes a fresh attempt id of the relay format by default', () => {
    const hub = createChannelHub();
    const popup = createFakePopup();
    const urls: string[] = [];
    openOAuthPopup({
      open: url => {
        urls.push(url);
        return popup.window;
      },
      createChannel: hub.create,
      requestToken: async () => ({ kind: 'signed-out' }),
      recordUnavailable: () => {},
    });
    openOAuthPopup({
      open: url => {
        urls.push(url);
        return popup.window;
      },
      createChannel: hub.create,
      requestToken: async () => ({ kind: 'signed-out' }),
      recordUnavailable: () => {},
    });

    const attempts = urls.map(url =>
      new URL(url, 'https://erd-editor.io').searchParams.get('attempt')
    );
    expect(attempts[0]).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(attempts[1]).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(attempts[0]).not.toBe(attempts[1]);
  });

  it('is blocked when the browser refuses the popup, listening to nothing', async () => {
    const { hub, requestToken, start } = setup({ blocked: true });

    const popup = start();

    await expect(popup.result).resolves.toEqual({ kind: 'blocked' });
    expect(hub.openCount(AUTH_CHANNEL)).toBe(0);
    popup.cancel();
    popup.dispose();
    popup.abandon(() => {});
    expect(requestToken).not.toHaveBeenCalled();
  });

  it("takes only its own attempt's oauth-done, then asks the relay for the token", async () => {
    const { hub, popup, requestToken, tokenResults, start, done } = setup();
    tokenResults.push(TOKEN_RESULT);
    const { result } = start();

    done({ attempt: 'ZyXwVuTsRqPoNmLkJiHgFe', ok: true, error: null });
    done({ ok: true, error: null });
    hub.broadcast(AUTH_CHANNEL, null);
    hub.broadcast(AUTH_CHANNEL, { type: 'other', attempt: ATTEMPT, ok: true });
    const outcome = await settle(result);
    expect(outcome).not.toHaveBeenCalled();
    expect(requestToken).not.toHaveBeenCalled();

    done({ attempt: ATTEMPT, ok: true, error: null });
    await vi.advanceTimersByTimeAsync(0);

    expect(outcome).toHaveBeenCalledWith({ kind: 'done', token: TOKEN });
    expect(requestToken).toHaveBeenCalledExactlyOnceWith(
      true,
      expect.any(Function)
    );
    expect(popup.state.closeCalls).toBe(1);
    expect(hub.openCount(AUTH_CHANNEL)).toBe(0);
  });

  it.each([
    ['access_denied', 'cancelled'],
    ['scope_missing', 'scope-missing'],
    ['state_mismatch', 'error'],
    ['invalid_grant', 'error'],
    ['upstream', 'error'],
    ['unknown', 'error'],
    [null, 'error'],
  ])(
    'reads a failed callback with %s as %s, asking no token',
    async (error, kind) => {
      const { requestToken, start, done } = setup();
      const { result } = start();

      done({ attempt: ATTEMPT, ok: false, error });

      expect(await settle(result)).toHaveBeenCalledWith({ kind });
      expect(requestToken).not.toHaveBeenCalled();
    }
  );

  it('reads a callback success the token then refuses as an error', async () => {
    const { tokenResults, start, done } = setup();
    tokenResults.push({ kind: 'signed-out' });
    const { result } = start();

    done({ attempt: ATTEMPT, ok: true, error: null });

    expect(await settle(result)).toHaveBeenCalledWith({ kind: 'error' });
  });

  it('records the relay unavailable when the token after a success fails its contract', async () => {
    const { tokenResults, recordUnavailable, start, done } = setup();
    tokenResults.push({ kind: 'unavailable' });
    const { result } = start();

    done({ attempt: ATTEMPT, ok: true, error: null });

    expect(await settle(result)).toHaveBeenCalledWith({ kind: 'unavailable' });
    expect(recordUnavailable).toHaveBeenCalledTimes(1);
  });

  describe('when the popup ends without a message', () => {
    const endings: Array<
      [
        string,
        (
          context: ReturnType<typeof setup>,
          popup: { cancel: () => void }
        ) => Promise<void>,
      ]
    > = [
      [
        'it is closed',
        async ({ popup }) => {
          popup.state.closed = true;
          await vi.advanceTimersByTimeAsync(POPUP_POLL_MS);
        },
      ],
      [
        'it shows the app itself, as without _routes.json',
        async ({ popup }) => {
          popup.atPage('https://erd-editor.io/');
          await vi.advanceTimersByTimeAsync(POPUP_POLL_MS);
        },
      ],
      [
        'it shows a 1027 page at the relay path',
        async ({ popup }) => {
          popup.atPage('https://erd-editor.io/api/auth/start?attempt=x');
          await vi.advanceTimersByTimeAsync(POPUP_POLL_MS);
        },
      ],
      [
        'five minutes pass',
        async ({ popup }) => {
          popup.atGoogle();
          await vi.advanceTimersByTimeAsync(POPUP_TIMEOUT_MS);
        },
      ],
      [
        'the person cancels',
        async (_context, handle) => {
          handle.cancel();
          await vi.advanceTimersByTimeAsync(0);
        },
      ],
    ];

    it.each(endings)(
      'asks for the token once when %s, and signs in on a 200',
      async (_label, end) => {
        const context = setup();
        context.tokenResults.push(TOKEN_RESULT);
        const handle = context.start();
        const outcome = await settle(handle.result);

        await end(context, handle);

        expect(outcome).toHaveBeenCalledWith({ kind: 'done', token: TOKEN });
        expect(context.requestToken).toHaveBeenCalledExactlyOnceWith(
          false,
          expect.any(Function)
        );
        expect(context.popup.state.closed).toBe(true);
        expect(context.hub.openCount(AUTH_CHANNEL)).toBe(0);
      }
    );

    it.each(endings)(
      'reads a 401 after %s as cancelled',
      async (_label, end) => {
        const context = setup();
        context.tokenResults.push({ kind: 'signed-out' });
        const handle = context.start();
        const outcome = await settle(handle.result);

        await end(context, handle);

        expect(outcome).toHaveBeenCalledWith({ kind: 'cancelled' });
        expect(context.requestToken).toHaveBeenCalledTimes(1);
        expect(context.recordUnavailable).not.toHaveBeenCalled();
      }
    );

    it.each(endings)(
      'reads any other answer after %s as unavailable until midnight',
      async (_label, end) => {
        const context = setup();
        context.tokenResults.push({ kind: 'unavailable' });
        const handle = context.start();
        const outcome = await settle(handle.result);

        await end(context, handle);

        expect(outcome).toHaveBeenCalledWith({ kind: 'unavailable' });
        expect(context.requestToken).toHaveBeenCalledTimes(1);
        expect(context.recordUnavailable).toHaveBeenCalledTimes(1);
      }
    );
  });

  it('reads an offline token answer as an error, recording nothing', async () => {
    const { popup, tokenResults, recordUnavailable, start } = setup();
    tokenResults.push({ kind: 'offline' });
    const { result } = start();
    const outcome = await settle(result);

    popup.state.closed = true;
    await vi.advanceTimersByTimeAsync(POPUP_POLL_MS);

    expect(outcome).toHaveBeenCalledWith({ kind: 'error' });
    expect(recordUnavailable).not.toHaveBeenCalled();
  });

  it('takes a token request that rejects as an unavailable relay', async () => {
    // A plain function, since a Vitest mock settles what it returns and would
    // hide a rejection nobody handles.
    const asked = vi.fn();
    const { popup, recordUnavailable, start } = setup({
      requestTokenWith: () => {
        asked();
        return Promise.reject(new Error('boom'));
      },
    });
    const { result } = start();
    const outcome = await settle(result);

    popup.state.closed = true;
    await vi.advanceTimersByTimeAsync(POPUP_POLL_MS);

    expect(outcome).toHaveBeenCalledWith({ kind: 'unavailable' });
    expect(asked).toHaveBeenCalledTimes(1);
    expect(recordUnavailable).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'about:blank before the first load',
      (popup: ReturnType<typeof createFakePopup>) =>
        popup.atPage('about:blank'),
    ],
    [
      'Google, which throws on access',
      (popup: ReturnType<typeof createFakePopup>) => popup.atGoogle(),
    ],
    [
      'a page still loading',
      (popup: ReturnType<typeof createFakePopup>) =>
        popup.atPage('https://erd-editor.io/', { readyState: 'interactive' }),
    ],
    [
      'the callback page, which closes itself',
      (popup: ReturnType<typeof createFakePopup>) =>
        popup.atPage('https://erd-editor.io/api/auth/callback', {
          marker: true,
        }),
    ],
  ])('keeps waiting while the popup shows %s', async (_label, show) => {
    const { popup, requestToken, start } = setup();
    const { result } = start();
    const outcome = await settle(result);

    show(popup);
    await vi.advanceTimersByTimeAsync(POPUP_POLL_MS * 10);

    expect(outcome).not.toHaveBeenCalled();
    expect(requestToken).not.toHaveBeenCalled();
    expect(popup.state.closed).toBe(false);
  });

  it('still takes a sign-in that finishes after the popup counted as cancelled', async () => {
    const { popup, tokenResults, onLate, start, done } = setup();
    tokenResults.push({ kind: 'signed-out' }, TOKEN_RESULT);
    const { result } = start();
    const outcome = await settle(result);

    // COOP closed the popup early, so the opener saw it closed at once.
    popup.state.closed = true;
    await vi.advanceTimersByTimeAsync(POPUP_POLL_MS);
    expect(outcome).toHaveBeenCalledWith({ kind: 'cancelled' });

    done({ attempt: ATTEMPT, ok: true, error: null });
    await vi.advanceTimersByTimeAsync(0);

    expect(onLate).toHaveBeenCalledWith({ kind: 'done', token: TOKEN });
    expect(outcome).toHaveBeenCalledTimes(1);
  });

  it('stops listening for a late sign-in once the five minutes are up', async () => {
    const { hub, popup, onLate, requestToken, start, done } = setup();
    const { result } = start();
    await settle(result);

    popup.state.closed = true;
    await vi.advanceTimersByTimeAsync(POPUP_TIMEOUT_MS);
    expect(hub.openCount(AUTH_CHANNEL)).toBe(0);

    done({ attempt: ATTEMPT, ok: true, error: null });
    await vi.advanceTimersByTimeAsync(0);

    expect(onLate).not.toHaveBeenCalled();
    expect(requestToken).toHaveBeenCalledTimes(1);
  });

  it('settles once when the message comes as the popup closes', async () => {
    const { popup, requestToken, tokenResults, start, done } = setup();
    tokenResults.push(TOKEN_RESULT);
    const { result, cancel } = start();
    const outcome = await settle(result);

    done({ attempt: ATTEMPT, ok: true, error: null });
    popup.state.closed = true;
    cancel();
    await vi.advanceTimersByTimeAsync(POPUP_POLL_MS);

    expect(outcome).toHaveBeenCalledTimes(1);
    expect(outcome).toHaveBeenCalledWith({ kind: 'done', token: TOKEN });
    expect(requestToken).toHaveBeenCalledTimes(1);
    expect(popup.state.closeCalls).toBe(1);
  });

  describe('when the callback crosses the token request of a close', () => {
    /** Closes the popup, lets the poll send its token request, and holds the answer. */
    async function closeAndHold(context: ReturnType<typeof setup>) {
      let answer: (result: RelayTokenResult) => void = () => {};
      context.requestToken.mockImplementationOnce(
        () => new Promise(resolve => (answer = resolve))
      );
      const handle = context.start();
      const outcome = await settle(handle.result);
      context.popup.state.closed = true;
      await vi.advanceTimersByTimeAsync(POPUP_POLL_MS);
      expect(context.requestToken).toHaveBeenCalledExactlyOnceWith(
        false,
        expect.any(Function)
      );
      return {
        handle,
        outcome,
        answer: (result: RelayTokenResult) => answer(result),
      };
    }

    it.each([
      ['scope_missing', 'a 401', { kind: 'signed-out' }, 'scope-missing'],
      ['access_denied', 'an older cookie', TOKEN_RESULT, 'cancelled'],
      ['upstream', 'an older cookie', TOKEN_RESULT, 'error'],
    ] as const)(
      'reads a failed callback with %s as the result, over %s',
      async (error, _label, token, kind) => {
        const context = setup();
        const { outcome, answer } = await closeAndHold(context);

        context.done({ attempt: ATTEMPT, ok: false, error });
        await vi.advanceTimersByTimeAsync(0);
        expect(outcome).not.toHaveBeenCalled();
        answer(token);
        await vi.advanceTimersByTimeAsync(0);

        expect(outcome).toHaveBeenCalledExactlyOnceWith({ kind });
        expect(context.requestToken).toHaveBeenCalledTimes(1);
        expect(context.onLate).not.toHaveBeenCalled();
        expect(context.hub.openCount(AUTH_CHANNEL)).toBe(0);
      }
    );

    it('asks for the token again when a successful callback crosses a 401', async () => {
      const context = setup();
      context.tokenResults.push(TOKEN_RESULT);
      const { outcome, answer } = await closeAndHold(context);

      context.done({ attempt: ATTEMPT, ok: true, error: null });
      context.done({ attempt: ATTEMPT, ok: false, error: 'unknown' });
      await vi.advanceTimersByTimeAsync(0);
      answer({ kind: 'signed-out' });
      await vi.advanceTimersByTimeAsync(0);

      expect(outcome).toHaveBeenCalledExactlyOnceWith({
        kind: 'done',
        token: TOKEN,
      });
      expect(
        context.requestToken.mock.calls.map(([succeeded]) => succeeded)
      ).toEqual([false, true]);
      expect(context.popup.state.closeCalls).toBe(1);
    });

    it('keeps the token of a close when a successful callback crosses it', async () => {
      const context = setup();
      const { outcome, answer } = await closeAndHold(context);

      context.done({ attempt: ATTEMPT, ok: true, error: null });
      await vi.advanceTimersByTimeAsync(0);
      answer(TOKEN_RESULT);
      await vi.advanceTimersByTimeAsync(0);

      expect(outcome).toHaveBeenCalledExactlyOnceWith({
        kind: 'done',
        token: TOKEN,
      });
      expect(context.requestToken).toHaveBeenCalledTimes(1);
    });

    it('stays cancelled when disposed before the token answer', async () => {
      const context = setup();
      const { handle, outcome, answer } = await closeAndHold(context);

      context.done({ attempt: ATTEMPT, ok: true, error: null });
      await vi.advanceTimersByTimeAsync(0);
      handle.dispose();
      answer({ kind: 'signed-out' });
      await vi.advanceTimersByTimeAsync(0);

      expect(outcome).toHaveBeenCalledExactlyOnceWith({ kind: 'cancelled' });
      expect(context.requestToken).toHaveBeenCalledTimes(1);
    });
  });

  it('times out while the token request of a cancel is still out, then stops', async () => {
    const { hub, requestToken, start } = setup();
    let answer: (result: RelayTokenResult) => void = () => {};
    requestToken.mockImplementationOnce(
      () => new Promise(resolve => (answer = resolve))
    );
    const { result, cancel } = start();
    const outcome = await settle(result);

    await vi.advanceTimersByTimeAsync(POPUP_TIMEOUT_MS - 1);
    cancel();
    await vi.advanceTimersByTimeAsync(1);
    answer({ kind: 'signed-out' });
    await vi.advanceTimersByTimeAsync(0);

    expect(outcome).toHaveBeenCalledWith({ kind: 'cancelled' });
    expect(hub.openCount(AUTH_CHANNEL)).toBe(0);
  });

  it('settles as cancelled on dispose, asking for no token', async () => {
    const { hub, popup, requestToken, start, done } = setup();
    const handle = start();
    const outcome = await settle(handle.result);

    handle.dispose();
    popup.state.closed = true;
    done({ attempt: ATTEMPT, ok: true, error: null });
    await vi.advanceTimersByTimeAsync(POPUP_TIMEOUT_MS);

    expect(outcome).toHaveBeenCalledExactlyOnceWith({ kind: 'cancelled' });
    expect(requestToken).not.toHaveBeenCalled();
    expect(hub.openCount(AUTH_CHANNEL)).toBe(0);
  });

  it('stays cancelled when disposed while the token request of a cancel is out', async () => {
    const { hub, requestToken, start, done, onLate } = setup();
    let answer: (result: RelayTokenResult) => void = () => {};
    requestToken.mockImplementationOnce(
      () => new Promise(resolve => (answer = resolve))
    );
    const handle = start();
    const outcome = await settle(handle.result);

    handle.cancel();
    handle.dispose();
    answer({ kind: 'signed-out' });
    await vi.advanceTimersByTimeAsync(0);
    done({ attempt: ATTEMPT, ok: true, error: null });
    await vi.advanceTimersByTimeAsync(0);

    expect(outcome).toHaveBeenCalledExactlyOnceWith({ kind: 'cancelled' });
    expect(onLate).not.toHaveBeenCalled();
    expect(hub.openCount(AUTH_CHANNEL)).toBe(0);
  });

  describe('the callback report a close may wait for', () => {
    /** A token request that waits for the report whenever the callback has not reported. */
    function reporting(
      waitFirst = 0
    ): ReturnType<typeof setup> & { reports: boolean[] } {
      const reports: boolean[] = [];
      const context = setup({
        requestTokenWith: async (succeeded, report) => {
          if (waitFirst)
            await new Promise(resolve => setTimeout(resolve, waitFirst));
          if (!succeeded) reports.push(await report());
          return TOKEN_RESULT;
        },
      });
      return Object.assign(context, { reports });
    }

    async function close(context: ReturnType<typeof setup>) {
      const handle = context.start();
      const outcome = await settle(handle.result);
      context.popup.state.closed = true;
      await vi.advanceTimersByTimeAsync(POPUP_POLL_MS);
      return outcome;
    }

    it('is true once a successful callback crosses the close', async () => {
      const context = reporting();
      const outcome = await close(context);
      expect(context.reports).toEqual([]);

      context.done({ attempt: ATTEMPT, ok: true, error: null });
      await vi.advanceTimersByTimeAsync(1);

      expect(context.reports).toEqual([true]);
      expect(outcome).toHaveBeenCalledExactlyOnceWith({
        kind: 'done',
        token: TOKEN,
      });
    });

    it('is false for a failed callback, whose failure is the result', async () => {
      const context = reporting();
      const outcome = await close(context);

      context.done({ attempt: ATTEMPT, ok: false, error: 'access_denied' });
      await vi.advanceTimersByTimeAsync(1);

      expect(context.reports).toEqual([false]);
      expect(outcome).toHaveBeenCalledExactlyOnceWith({ kind: 'cancelled' });
    });

    it('is false once the grace passes without a report', async () => {
      const context = reporting();
      const outcome = await close(context);

      await vi.advanceTimersByTimeAsync(CALLBACK_GRACE_MS - 1);
      expect(context.reports).toEqual([]);
      await vi.advanceTimersByTimeAsync(1);

      expect(context.reports).toEqual([false]);
      expect(outcome).toHaveBeenCalledWith({ kind: 'done', token: TOKEN });
    });

    it('answers at once for a report that came before it was asked', async () => {
      const context = reporting(10);
      await close(context);

      context.done({ attempt: ATTEMPT, ok: true, error: null });
      await vi.advanceTimersByTimeAsync(1);
      expect(context.reports).toEqual([]);
      await vi.advanceTimersByTimeAsync(9);

      expect(context.reports).toEqual([true]);
    });
  });

  describe('when abandoned by a sign-out', () => {
    it('closes the popup, settles as cancelled and reports a success its callback still sends', async () => {
      const { hub, popup, requestToken, start, done } = setup();
      const handle = start();
      const outcome = await settle(handle.result);
      const signedIn = vi.fn();

      handle.abandon(signedIn);
      await vi.advanceTimersByTimeAsync(POPUP_POLL_MS);

      expect(outcome).toHaveBeenCalledExactlyOnceWith({ kind: 'cancelled' });
      expect(popup.state.closeCalls).toBe(1);
      expect(hub.openCount(AUTH_CHANNEL)).toBe(1);

      done({ attempt: 'ZyXwVuTsRqPoNmLkJiHgFe', ok: true, error: null });
      await vi.advanceTimersByTimeAsync(0);
      expect(signedIn).not.toHaveBeenCalled();
      done({ attempt: ATTEMPT, ok: true, error: null });
      await vi.advanceTimersByTimeAsync(0);

      expect(signedIn).toHaveBeenCalledTimes(1);
      expect(requestToken).not.toHaveBeenCalled();
      expect(hub.openCount(AUTH_CHANNEL)).toBe(0);
    });

    it.each([
      [
        'a failed callback',
        async ({ done }: ReturnType<typeof setup>) => {
          done({ attempt: ATTEMPT, ok: false, error: 'access_denied' });
          await vi.advanceTimersByTimeAsync(0);
        },
      ],
      [
        'the five minutes',
        async ({ done }: ReturnType<typeof setup>) => {
          await vi.advanceTimersByTimeAsync(POPUP_TIMEOUT_MS);
          done({ attempt: ATTEMPT, ok: true, error: null });
          await vi.advanceTimersByTimeAsync(0);
        },
      ],
    ])('stops listening at %s', async (_label, end) => {
      const context = setup();
      const handle = context.start();
      const signedIn = vi.fn();
      handle.abandon(signedIn);

      await end(context);

      expect(signedIn).not.toHaveBeenCalled();
      expect(context.hub.openCount(AUTH_CHANNEL)).toBe(0);
    });

    it('drops the token request of a close still out, and takes a success after it', async () => {
      const context = setup();
      let answer: (result: RelayTokenResult) => void = () => {};
      context.requestToken.mockImplementationOnce(
        () => new Promise(resolve => (answer = resolve))
      );
      const handle = context.start();
      const outcome = await settle(handle.result);
      context.popup.state.closed = true;
      await vi.advanceTimersByTimeAsync(POPUP_POLL_MS);
      const signedIn = vi.fn();

      handle.abandon(signedIn);
      context.done({ attempt: ATTEMPT, ok: true, error: null });
      await vi.advanceTimersByTimeAsync(0);
      answer({ kind: 'signed-out' });
      await vi.advanceTimersByTimeAsync(0);

      expect(signedIn).toHaveBeenCalledTimes(1);
      expect(outcome).toHaveBeenCalledExactlyOnceWith({ kind: 'cancelled' });
      expect(context.requestToken).toHaveBeenCalledTimes(1);
      expect(context.onLate).not.toHaveBeenCalled();
    });

    it('stops at once when the five minutes ran out while a token request was out', async () => {
      const context = setup();
      context.requestToken.mockImplementationOnce(() => new Promise(() => {}));
      const handle = context.start();
      context.popup.atGoogle();
      await vi.advanceTimersByTimeAsync(POPUP_TIMEOUT_MS);
      expect(context.requestToken).toHaveBeenCalledTimes(1);

      handle.abandon(() => {});

      expect(context.hub.openCount(AUTH_CHANNEL)).toBe(0);
    });

    it('does nothing once the popup has its result', async () => {
      const { popup, tokenResults, start, done } = setup();
      tokenResults.push(TOKEN_RESULT);
      const handle = start();
      const outcome = await settle(handle.result);
      done({ attempt: ATTEMPT, ok: true, error: null });
      await vi.advanceTimersByTimeAsync(0);
      const signedIn = vi.fn();

      handle.abandon(signedIn);
      done({ attempt: ATTEMPT, ok: true, error: null });
      await vi.advanceTimersByTimeAsync(0);

      expect(outcome).toHaveBeenCalledExactlyOnceWith({
        kind: 'done',
        token: TOKEN,
      });
      expect(popup.state.closeCalls).toBe(1);
      expect(signedIn).not.toHaveBeenCalled();
    });
  });

  it.each([
    ['abandoned', (popup: OAuthPopup) => popup.abandon(() => {})],
    ['disposed', (popup: OAuthPopup) => popup.dispose()],
  ])(
    'reports no late sign-in %s while its token request is out',
    async (_label, end) => {
      const { hub, popup, requestToken, start, done, onLate } = setup();
      const handle = start();
      await settle(handle.result);
      popup.state.closed = true;
      await vi.advanceTimersByTimeAsync(POPUP_POLL_MS);
      let answer: (result: RelayTokenResult) => void = () => {};
      requestToken.mockImplementationOnce(
        () => new Promise(resolve => (answer = resolve))
      );
      done({ attempt: ATTEMPT, ok: true, error: null });
      await vi.advanceTimersByTimeAsync(0);
      expect(requestToken).toHaveBeenCalledTimes(2);

      end(handle);
      answer(TOKEN_RESULT);
      await vi.advanceTimersByTimeAsync(0);

      expect(onLate).not.toHaveBeenCalled();
      expect(hub.openCount(AUTH_CHANNEL)).toBe(0);
    }
  );

  it('keeps the result it already had when disposed later', async () => {
    const { tokenResults, start, done } = setup();
    tokenResults.push(TOKEN_RESULT);
    const handle = start();
    const outcome = await settle(handle.result);
    done({ attempt: ATTEMPT, ok: true, error: null });
    await vi.advanceTimersByTimeAsync(0);

    handle.dispose();
    await vi.advanceTimersByTimeAsync(0);

    expect(outcome).toHaveBeenCalledExactlyOnceWith({
      kind: 'done',
      token: TOKEN,
    });
  });
});
