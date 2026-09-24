import * as Sentry from '@sentry/react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router';

import {
  browserLocks,
  browserStorage,
  createDriveClient,
  createGdriveSession,
  createTokenManager,
  type FetchLike,
  type GdriveSession,
  loadGis,
  type SessionLocation,
  type SessionSnapshot,
} from '@/services/gdrive';
import { settleReported } from '@/utils/reportError';

const noSubscribe = () => () => {};

/**
 * The tab's /gdrive session, assembled from the browser: fetch and window.open
 * bound here, since the modules call them without a receiver. The route's
 * query goes in as the session's location, and navigate comes back out.
 */
export function useGdriveSession(clientId: string): {
  session: GdriveSession | null;
  snapshot: SessionSnapshot | null;
} {
  const [params, setParams] = useSearchParams();
  const setParamsRef = useRef(setParams);
  setParamsRef.current = setParams;
  const location: SessionLocation = {
    state: params.get('state'),
    file: params.get('file'),
  };
  const locationRef = useRef(location);
  locationRef.current = location;
  const [session, setSession] = useState<GdriveSession | null>(null);

  useEffect(() => {
    const send: FetchLike = (input, init) => fetch(input, init);
    const createChannel = (name: string) => new BroadcastChannel(name);
    const tokens = createTokenManager({
      fetch: send,
      clientId,
      createChannel,
      locks: globalThis.navigator?.locks ?? null,
      storage: browserStorage(),
      loadGis,
      openWindow: (url, target, features) => window.open(url, target, features),
      events: window,
      document,
    });
    const drive = createDriveClient({
      fetch: send,
      getAccessToken: () => tokens.getAccessToken(),
      onUnauthorized: stale => tokens.onUnauthorized(stale),
      onInsufficientScope: () => tokens.reportInsufficientScope(),
    });
    const next = createGdriveSession({
      tokens,
      drive,
      locks: browserLocks(),
      createChannel,
      navigate: (fileId, { replace }) =>
        setParamsRef.current(fileId ? { file: fileId } : {}, { replace }),
      events: window,
      document,
    });
    next.setLocation(locationRef.current);
    setSession(next);
    void settleReported(next.start)();

    return () => {
      next.dispose();
      tokens.dispose();
    };
  }, [clientId]);

  useEffect(() => {
    session?.setLocation({ state: location.state, file: location.file });
  }, [session, location.state, location.file]);

  const snapshot = useSyncExternalStore(
    session?.subscribe ?? noSubscribe,
    () => session?.getSnapshot() ?? null
  );

  // Which sign-in and save state an error report came from, never an id or name.
  const mode = snapshot?.token.mode;
  const saveState = snapshot?.document?.saveState ?? 'none';
  useEffect(() => {
    if (mode) Sentry.setTag('gdrive.mode', mode);
    Sentry.setTag('gdrive.saveState', saveState);
  }, [mode, saveState]);

  return { session, snapshot };
}
