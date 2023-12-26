import { basicSetup, EditorState } from '@codemirror/basic-setup';
import { indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap, ViewUpdate } from '@codemirror/view';
import { Ref } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

import { useContext } from '@/hooks/useContext';

type EditorTuple = readonly [Ref<any>, { current: EditorView }];

export interface Options {
  onChange(editor: EditorView): void;
  typescript: boolean;
}

export function useEditor(options?: Partial<Options>): EditorTuple {
  const context = useContext();
  const parentRef = useRef<Element>();
  const editorRef = useRef<EditorView>() as { current: EditorView };

  useEffect(() => {
    editorRef.current = new EditorView({
      state: EditorState.create({
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          javascript({
            typescript: options?.typescript,
          }),
          oneDark,
          EditorView.updateListener.of((view: ViewUpdate) => {
            view.docChanged &&
              options?.onChange &&
              editorRef.current &&
              options.onChange(editorRef.current);
          }),
        ],
      }),
      root: context.host,
      parent: parentRef.current,
    });

    return () => editorRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [parentRef, editorRef];
}
