import '@dineug/erd-editor';

import type { ErdEditorElement } from '@dineug/erd-editor';
import { useAtomValue } from 'jotai';
import { useLayoutEffect, useRef } from 'react';

import { nicknameStorageAtom } from '@/atoms/modules/collaborative';
import {
  useApplyPickedLocale,
  useLocalePreference,
} from '@/atoms/modules/locale';
import { useReplicationSchemaEntity } from '@/atoms/modules/sidebar';
import { useApplyPresetTheme, useThemeState } from '@/atoms/modules/theme';
import { SchemaEntity } from '@/services/indexeddb/modules/schema';
import { bridge } from '@/utils/broadcastChannel';

import * as styles from './Editor.styles';

interface EditorProps {
  entity: SchemaEntity;
}

const Editor: React.FC<EditorProps> = props => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ErdEditorElement | null>(null);
  const theme = useThemeState();
  const applyPresetTheme = useApplyPresetTheme();
  const locale = useLocalePreference();
  const applyPickedLocale = useApplyPickedLocale();
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
    editor.enableLocalePicker = true;
    editor.setInitialValue(props.entity.value);
    editor.enableWelcomeScreen = true;

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

    const handleChangeLocale = (event: Event) => {
      applyPickedLocale((event as CustomEvent).detail);
    };

    editor.addEventListener('changePresetTheme', handleChangePresetTheme);
    editor.addEventListener('changeLocale', handleChangeLocale);
    $viewer.appendChild(editor);

    return () => {
      $viewer.removeChild(editor);
      editor.removeEventListener('changePresetTheme', handleChangePresetTheme);
      editor.removeEventListener('changeLocale', handleChangeLocale);
      Array.from(unsubscribeSet).forEach(unsubscribe => unsubscribe());
      unsubscribeSet.clear();
      editor.destroy();
      editorRef.current = null;
    };
  }, [
    applyPresetTheme,
    applyPickedLocale,
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

  useLayoutEffect(() => {
    editorRef.current?.setLocale(locale);
  }, [locale]);

  return <div css={styles.scope} ref={viewerRef} />;
};

export default Editor;
