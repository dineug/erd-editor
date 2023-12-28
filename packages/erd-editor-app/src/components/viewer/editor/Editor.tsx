import {
  ErdEditorElement,
  setGetShikiServiceCallback,
} from '@dineug/erd-editor';
import { useAtom } from 'jotai';
import { useLayoutEffect, useRef } from 'react';

import { useUpdateSchemaEntityValue } from '@/atoms/modules/sidebar';
import { themeAtom } from '@/atoms/modules/theme';
import { SchemaEntity } from '@/services/indexeddb/modules/schema';

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
  const updateSchemaEntityValue = useUpdateSchemaEntityValue();

  useLayoutEffect(() => {
    const $viewer = viewerRef.current;
    if (!$viewer) return;

    const editor = document.createElement('erd-editor');
    editorRef.current = editor;
    editor.enableThemeBuilder = true;
    editor.setInitialValue(props.entity.value);

    const handleChange = () => {
      updateSchemaEntityValue({
        id: props.entity.id,
        value: editor.value,
      });
    };

    const handleChangePresetTheme = (event: Event) => {
      const e = event as CustomEvent;

      setTheme(draft => {
        draft.appearance = e.detail.appearance;
        draft.accentColor = e.detail.accentColor;
        draft.grayColor = e.detail.grayColor;
      });
    };

    editor.addEventListener('change', handleChange);
    editor.addEventListener('changePresetTheme', handleChangePresetTheme);
    $viewer.appendChild(editor);

    return () => {
      $viewer.removeChild(editor);
      editor.removeEventListener('change', handleChange);
      editor.removeEventListener('changePresetTheme', handleChangePresetTheme);
      editor.destroy();
      editorRef.current = null;
    };
  }, [setTheme, updateSchemaEntityValue, props.entity.id, props.entity.value]);

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
