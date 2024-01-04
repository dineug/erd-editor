import {
  ErdEditorElement,
  setGetShikiServiceCallback,
} from '@dineug/erd-editor';
import { attachCancel, cancel, go, isCancel } from '@dineug/go';
import { Flex, Text } from '@radix-ui/themes';
import { useAtom } from 'jotai';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';

import { themeAtom } from '@/atoms/modules/theme';
import {
  decryptFromJson,
  EncryptJson,
  encryptToJson,
  importKey,
} from '@/utils/crypto';
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

const TIMEOUT = 1000 * 15;

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

    const task = go(function* () {
      const key: Awaited<ReturnType<typeof importKey>> =
        yield importKey(secretKey);
      const socket = io(import.meta.env.WEBSOCKET_URL, {
        withCredentials: true,
      });
      const unsubscribeSet = new Set<() => void>();
      const editor = document.createElement('erd-editor');
      const sharedStore = editor.getSharedStore();
      editorRef.current = editor;
      editor.enableThemeBuilder = true;

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
      }, TIMEOUT);
      const clearInitializationTimer = () => {
        clearTimeout(initializationTimerId);
      };

      let hostLeaveStartLoadingTimerId = -1;
      let hostLeaveTimerId = -1;

      socket
        .on('host-leave', () => {
          editor.blur();
          sharedStore.disconnect();
          clearTimeout(hostLeaveStartLoadingTimerId);
          clearTimeout(hostLeaveTimerId);

          hostLeaveStartLoadingTimerId = setTimeout(() => {
            setHostLeaveLoading(true);
          }, 1000 * 3);
          hostLeaveTimerId = setTimeout(() => {
            setError(new HostStopSessionError());
          }, TIMEOUT);
        })
        .on('host-join', () => {
          sharedStore.connection();
          clearTimeout(hostLeaveStartLoadingTimerId);
          clearTimeout(hostLeaveTimerId);
          setHostLeaveLoading(false);
        })
        .on(
          'host-schema',
          async ({ value }: { roomId: string; value: EncryptJson }) => {
            if (!readyResolve) return;
            clearInitializationTimer();

            try {
              const json = await decryptFromJson(value, key);
              readyResolve(json);
            } catch (error) {
              readyReject?.(error);
            } finally {
              readyResolve = null;
              readyReject = null;
              setInitializationLoading(false);
            }
          }
        )
        .on(
          'dispatch',
          async ({ value }: { roomId: string; value: EncryptJson }) => {
            const json = await decryptFromJson(value, key);
            const actions = JSON.parse(json);
            sharedStore.dispatch(actions);
          }
        )
        .on('connect', () => {
          socket.emit('guest-join-room', roomId);
          sharedStore.connection();
        })
        .on('disconnect', () => {
          sharedStore.disconnect();
        })
        .emit('guest-join-room', roomId)
        .emit('request-host-schema', roomId);

      unsubscribeSet.add(
        sharedStore.subscribe(async actions => {
          const value = await encryptToJson(JSON.stringify(actions), key);
          socket.emit('dispatch', { roomId, value });
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

      yield attachCancel(new Promise(() => {}), () => {
        clearInitializationTimer();
        socket.emit('guest-leave-room', roomId);
        socket.disconnect();
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
      });
    });

    task.catch(error => {
      if (isCancel(error)) return;
      setError(error);
    });

    return () => {
      cancel(task);
    };
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
