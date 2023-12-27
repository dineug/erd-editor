import { ErdEditorElement } from '@dineug/erd-editor';
import { Flex } from '@radix-ui/themes';
import { useAtom } from 'jotai';
import { useLayoutEffect, useRef } from 'react';

import { themeAtom } from '@/store/modules/theme';

import * as styles from './Viewer.styles';

interface ViewerProps {}

const Viewer: React.FC<ViewerProps> = () => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ErdEditorElement | null>(null);
  const [theme, setTheme] = useAtom(themeAtom);

  useLayoutEffect(() => {
    const $viewer = viewerRef.current;
    if (!$viewer) return;

    const editor = document.createElement('erd-editor');
    editorRef.current = editor;
    editor.enableThemeBuilder = true;

    const handleChange = () => {
      console.log('handleChange');
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
  }, [setTheme]);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.setPresetTheme({
      appearance: theme.appearance as any,
      accentColor: theme.accentColor,
      grayColor: theme.grayColor as any,
    });
  }, [theme]);

  return <Flex css={styles.root} ref={viewerRef}></Flex>;
};

export default Viewer;
