import '@dineug/erd-editor';

import type { ErdEditorElement } from '@dineug/erd-editor';
import { useAtomValue } from 'jotai';
import { useLayoutEffect, useRef } from 'react';

import { nicknameStorageAtom } from '@/atoms/modules/collaborative';
import { useReplicationSchemaEntity } from '@/atoms/modules/sidebar';
import { useApplyPresetTheme, useResolvedTheme } from '@/atoms/modules/theme';
import { SchemaEntity } from '@/services/indexeddb/modules/schema';
import { bridge } from '@/utils/broadcastChannel';

import * as styles from './Editor.styles';

interface EditorProps {
  entity: SchemaEntity;
}

const Editor: React.FC<EditorProps> = props => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ErdEditorElement | null>(null);
  const theme = useResolvedTheme();
  const applyPresetTheme = useApplyPresetTheme();
  const replicationSchemaEntity = useReplicationSchemaEntity();
  const nickname = useAtomValue(nicknameStorageAtom);
  const nicknameRef = useRef(nickname);
  nicknameRef.current = nickname;

  useLayoutEffect(() => {
    const $viewer = viewerRef.current;
    if (!$viewer) return;

    const unsubscribeSet = new Set<() => void>();
    const editor = document.createElement('erd-editor');
    const sharedStore = editor.getSharedStore({
      getNickname: () => nicknameRef.current,
    });
    editorRef.current = editor;
    editor.enableThemeBuilder = true;
    editor.setInitialValue(props.entity.value);

    unsubscribeSet
      .add(
        sharedStore.subscribe(actions => {
          replicationSchemaEntity({
            id: props.entity.id,
            actions,
          });
        })
      )
      .add(
        bridge.on({
          replicationSchemaEntity: ({ payload: { id, actions } }) => {
            if (id === props.entity.id) {
              sharedStore.dispatch(actions);
            }
          },
        })
      );

    const handleChangePresetTheme = (event: Event) => {
      applyPresetTheme((event as CustomEvent).detail);
    };

    editor.addEventListener('changePresetTheme', handleChangePresetTheme);
    $viewer.appendChild(editor);

    return () => {
      $viewer.removeChild(editor);
      editor.removeEventListener('changePresetTheme', handleChangePresetTheme);
      Array.from(unsubscribeSet).forEach(unsubscribe => unsubscribe());
      unsubscribeSet.clear();
      editor.destroy();
      editorRef.current = null;
    };
  }, [
    applyPresetTheme,
    replicationSchemaEntity,
    props.entity.id,
    props.entity.value,
  ]);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.setPresetTheme({
      appearance: theme.appearance,
      accentColor: theme.accentColor,
      grayColor: theme.grayColor as any,
    });
  }, [theme]);

  return <div css={styles.scope} ref={viewerRef} />;
};

export default Editor;
