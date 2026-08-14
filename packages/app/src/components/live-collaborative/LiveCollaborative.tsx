import {
  ErdEditorElement,
  setGetShikiServiceCallback,
} from '@dineug/erd-editor';
import { Flex, Text } from '@radix-ui/themes';
import { useAtom } from 'jotai';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { themeAtom } from '@/atoms/modules/theme';
import {
  createCollaborativeGuest,
  RELAY_TIMEOUT,
} from '@/services/collaborative/guest';
import { STRATEGIES } from '@/services/collaborative/room';
import {
  HostStopSessionError,
  InvalidHashError,
  NotFoundHostError,
} from '@/utils/errors';

import * as styles from './LiveCollaborative.styles';

import('@dineug/erd-editor-shiki-worker').then(({ getShikiService }) => {
  setGetShikiServiceCallback(getShikiService);
});

interface LiveCollaborativeProps {}

/** Overall budget for receiving the host's snapshot, across every relay. */
const INITIALIZATION_TIMEOUT = RELAY_TIMEOUT * (STRATEGIES.length + 1);
const HOST_LEAVE_LOADING_DELAY = 1000 * 3;
const HOST_LEAVE_TIMEOUT = 1000 * 15;

const LiveCollaborative: React.FC<LiveCollaborativeProps> = () => {
  const location = useLocation();
  const [roomId, secretKey] = useMemo(
    () => location.hash.replace('#', '').split(','),
    [location.hash]
  );
  const viewerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ErdEditorElement | null>(null);
  const [theme, setTheme] = useAtom(themeAtom);
  const [error, setError] = useState<unknown | null>(null);
  const [initializationLoading, setInitializationLoading] = useState(true);
  const [hostLeaveLoading, setHostLeaveLoading] = useState(false);

  if (!roomId?.trim() || !secretKey?.trim()) throw new InvalidHashError();
  if (error) throw error;

  useLayoutEffect(() => {
    const $viewer = viewerRef.current;
    if (!$viewer) return;

    try {
      const unsubscribeSet = new Set<() => void>();
      const editor = document.createElement('erd-editor');
      const sharedStore = editor.getSharedStore();
      editorRef.current = editor;
      editor.enableThemeBuilder = true;
      // Nothing leaves this guest until a host has actually answered.
      sharedStore.disconnect();

      let readyResolve: ((value: string) => void) | null = null;
      let readyReject: ((error: unknown) => void) | null = null;
      const ready = new Promise<string>((resolve, reject) => {
        readyResolve = resolve;
        readyReject = reject;
      });

      ready
        .then(value => {
          editor.setInitialValue(value);
          $viewer.appendChild(editor);
        })
        .catch(setError);

      const initializationTimerId = setTimeout(() => {
        readyReject?.(new NotFoundHostError());
      }, INITIALIZATION_TIMEOUT);
      const clearInitializationTimer = () => {
        clearTimeout(initializationTimerId);
      };

      let hostLeaveStartLoadingTimerId = -1;
      let hostLeaveTimerId = -1;
      const clearHostLeaveTimer = () => {
        clearTimeout(hostLeaveStartLoadingTimerId);
        clearTimeout(hostLeaveTimerId);
      };

      const guest = createCollaborativeGuest(roomId, secretKey, {
        // A host re-announces itself on every reconnect; only the first snapshot
        // seeds the editor, the action stream carries it from there.
        onSchema: value => {
          if (!readyResolve) return;
          clearInitializationTimer();
          readyResolve(value);
          readyResolve = null;
          readyReject = null;
          setInitializationLoading(false);
        },
        onDispatch: actions => {
          sharedStore.dispatch(actions);
        },
        onHostJoin: () => {
          sharedStore.connection();
          clearHostLeaveTimer();
          setHostLeaveLoading(false);
        },
        onHostLeave: () => {
          sharedStore.disconnect();
          clearHostLeaveTimer();
          hostLeaveStartLoadingTimerId = window.setTimeout(() => {
            editor.blur();
            setHostLeaveLoading(true);
          }, HOST_LEAVE_LOADING_DELAY);
          hostLeaveTimerId = window.setTimeout(() => {
            setError(new HostStopSessionError());
          }, HOST_LEAVE_TIMEOUT);
        },
        onNotFoundHost: () => {
          clearInitializationTimer();
          readyReject?.(new NotFoundHostError());
        },
        onError: error => {
          readyReject ? readyReject(error) : setError(error);
        },
      });

      unsubscribeSet.add(
        sharedStore.subscribe(actions => {
          guest.dispatch(actions);
        })
      );

      const handleChangePresetTheme = (event: Event) => {
        const e = event as CustomEvent;

        setTheme(draft => {
          draft.appearance = e.detail.appearance;
          draft.accentColor = e.detail.accentColor;
          draft.grayColor = e.detail.grayColor;
        });
      };

      editor.addEventListener('changePresetTheme', handleChangePresetTheme);

      return () => {
        guest.close();
        clearInitializationTimer();
        clearHostLeaveTimer();
        if ($viewer === editor.parentElement) {
          $viewer.removeChild(editor);
        }
        editor.removeEventListener(
          'changePresetTheme',
          handleChangePresetTheme
        );
        Array.from(unsubscribeSet).forEach(unsubscribe => unsubscribe());
        unsubscribeSet.clear();
        editor.destroy();
        editorRef.current = null;
      };
    } catch (error) {
      setError(error);
    }
  }, [roomId, secretKey, setTheme]);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.setPresetTheme({
      appearance: theme.appearance as any,
      accentColor: theme.accentColor,
      grayColor: theme.grayColor as any,
    });
  }, [theme]);

  return (
    <Flex css={styles.root} direction="column" align="center" justify="center">
      <div css={styles.scope} ref={viewerRef} />
      {initializationLoading ? (
        <Flex
          css={styles.overlay}
          direction="column"
          align="center"
          justify="center"
        >
          <Text size="6">Looking for a host...</Text>
        </Flex>
      ) : null}
      {hostLeaveLoading ? (
        <Flex
          css={styles.overlay}
          direction="column"
          align="center"
          justify="center"
        >
          <Text size="6">Waiting for a host...</Text>
        </Flex>
      ) : null}
    </Flex>
  );
};

export default LiveCollaborative;
