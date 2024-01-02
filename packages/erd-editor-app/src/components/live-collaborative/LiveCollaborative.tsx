import {
  ErdEditorElement,
  setGetShikiServiceCallback,
} from '@dineug/erd-editor';
import { attachCancel, cancel, go } from '@dineug/go';
import { Flex } from '@radix-ui/themes';
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
import { InvalidHashError } from '@/utils/errors';

import * as styles from './LiveCollaborative.styles';

import('@dineug/erd-editor-shiki-worker').then(({ getShikiService }) => {
  setGetShikiServiceCallback(getShikiService);
});

interface LiveCollaborativeProps {}

const LiveCollaborative: React.FC<LiveCollaborativeProps> = () => {
  const location = useLocation();
  const [roomId, secretKey] = useMemo(
    () => location.hash.replace('#', '').split(','),
    [location.hash]
  );
  const [error, setError] = useState<unknown | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ErdEditorElement | null>(null);
  const [theme, setTheme] = useAtom(themeAtom);

  if (!roomId || !secretKey) throw new InvalidHashError();
  if (error) throw error;

  useLayoutEffect(() => {
    const $viewer = viewerRef.current;
    if (!$viewer) return;

    const task = go(function* () {
      const key: Awaited<ReturnType<typeof importKey>> =
        yield importKey(secretKey);
      const socket = io(import.meta.env.WEBSOCKET_URL);

      const unsubscribeSet = new Set<() => void>();
      const editor = document.createElement('erd-editor');
      editorRef.current = editor;
      editor.enableThemeBuilder = true;
      const sharedStore = editor.getSharedStore();

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

      socket.on('connect', () => {
        socket.emit('join-room', roomId);
        socket.emit('request-host-schema', roomId);

        // setTimeout: host-schema
      });

      socket.on('host-schema', async (value: EncryptJson) => {
        if (!readyResolve) return;

        try {
          const json = await decryptFromJson(value, key);
          readyResolve(json);
        } catch (error) {
          readyReject?.(error);
        } finally {
          readyResolve = null;
          readyReject = null;
        }
      });

      socket.on(
        'dispatch',
        async ({ value }: { roomId: string; value: EncryptJson }) => {
          const json = await decryptFromJson(value, key);
          const actions = JSON.parse(json);
          sharedStore.dispatch(actions);
        }
      );

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

    task.catch(setError);

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
    </Flex>
  );
};

export default LiveCollaborative;
