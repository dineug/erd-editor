import '@dineug/erd-editor';

import type { ErdEditorElement } from '@dineug/erd-editor';
import { useLayoutEffect, useRef } from 'react';

import { useApplyPresetTheme, useResolvedTheme } from '@/atoms/modules/theme';
import type { DocumentController, EditorAdapter } from '@/services/gdrive';
import { reportError } from '@/utils/reportError';

import * as styles from './GdriveEditor.styles';

interface GdriveEditorProps {
  controller: DocumentController;
  readonly: boolean;
}

/**
 * The element for one load of a Drive file; the viewer keys it by file and
 * epoch, so a reload or a takeover makes a new one. The controller drives it
 * through the adapter: the value, the shared store's batches, change events.
 */
const GdriveEditor: React.FC<GdriveEditorProps> = ({
  controller,
  readonly,
}) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ErdEditorElement | null>(null);
  const readonlyRef = useRef(readonly);
  readonlyRef.current = readonly;
  const theme = useResolvedTheme();
  const applyPresetTheme = useApplyPresetTheme();

  useLayoutEffect(() => {
    const $viewer = viewerRef.current;
    if (!$viewer) return;

    const editor = document.createElement('erd-editor');
    // One person's tabs share edits, never where the pointer or focus is.
    const sharedStore = editor.getSharedStore({
      mouseTracker: false,
      focusTracker: false,
    });
    editorRef.current = editor;
    editor.enableThemeBuilder = true;
    editor.readonly = readonlyRef.current;

    const adapter: EditorAdapter = {
      getValue: () => editor.value,
      setInitialValue: value => editor.setInitialValue(value),
      subscribeLocal: listener => sharedStore.subscribe(listener),
      applyRemote: actions =>
        sharedStore.dispatch(
          actions as Parameters<typeof sharedStore.dispatch>[0]
        ),
      onChange: listener => {
        editor.addEventListener('change', listener);
        return () => editor.removeEventListener('change', listener);
      },
    };
    // A load that another replaced meanwhile throws; its successor mounts anew.
    let detach = () => {};
    try {
      detach = controller.attach(adapter);
    } catch (error) {
      reportError(error);
    }

    const handleChangePresetTheme = (event: Event) => {
      applyPresetTheme((event as CustomEvent).detail);
    };
    editor.addEventListener('changePresetTheme', handleChangePresetTheme);
    $viewer.appendChild(editor);

    return () => {
      detach();
      $viewer.removeChild(editor);
      editor.removeEventListener('changePresetTheme', handleChangePresetTheme);
      editor.destroy();
      editorRef.current = null;
    };
  }, [controller, applyPresetTheme]);

  useLayoutEffect(() => {
    if (editorRef.current) editorRef.current.readonly = readonly;
  }, [readonly]);

  useLayoutEffect(() => {
    editorRef.current?.setPresetTheme({
      appearance: theme.appearance,
      accentColor: theme.accentColor,
      grayColor: theme.grayColor as any,
    });
  }, [theme]);

  return <div css={styles.scope} ref={viewerRef} />;
};

export default GdriveEditor;
