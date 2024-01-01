import {
  ErdEditorElement,
  setGetShikiServiceCallback,
} from '@dineug/erd-editor';
import { useAtom } from 'jotai';
import { useLayoutEffect, useRef } from 'react';

import { useReplicationSchemaEntity } from '@/atoms/modules/sidebar';
import { themeAtom } from '@/atoms/modules/theme';
import { SchemaEntity } from '@/services/indexeddb/modules/schema';
import { bridge } from '@/utils/broadcastChannel';

import * as styles from './Editor.styles';

import('@dineug/erd-editor-shiki-worker').then(({ getShikiService }) => {
  setGetShikiServiceCallback(getShikiService);
});

interface EditorProps {
  entity: SchemaEntity;
}

const Editor: React.FC<EditorProps> = props => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ErdEditorElement | null>(null);
  const [theme, setTheme] = useAtom(themeAtom);
  const replicationSchemaEntity = useReplicationSchemaEntity();

  useLayoutEffect(() => {
    const $viewer = viewerRef.current;
    if (!$viewer) return;

    const unsubscribeSet = new Set<() => void>();
    const editor = document.createElement('erd-editor');
    editorRef.current = editor;
    editor.enableThemeBuilder = true;
    editor.setInitialValue(props.entity.value);

    const sharedStore = editor.getSharedStore({ mouseTracker: false });

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
      const e = event as CustomEvent;

      setTheme(draft => {
        draft.appearance = e.detail.appearance;
        draft.accentColor = e.detail.accentColor;
        draft.grayColor = e.detail.grayColor;
      });
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
  }, [setTheme, replicationSchemaEntity, props.entity.id, props.entity.value]);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.setPresetTheme({
      appearance: theme.appearance as any,
      accentColor: theme.accentColor,
      grayColor: theme.grayColor as any,
    });
  }, [theme]);

  return <div css={styles.scope} ref={viewerRef} />;
};

export default Editor;
