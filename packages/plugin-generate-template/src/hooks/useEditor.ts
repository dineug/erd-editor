import { basicSetup, EditorState } from '@codemirror/basic-setup';
import { defaultTabBinding } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap, ViewUpdate } from '@codemirror/view';
import { Ref } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

import { useContext } from '@/hooks/useContext';

type EditorTuple = readonly [Ref<any>, { current: EditorView }];

export interface Options {
  onChange(editor: EditorView): void;
}

export function useEditor(options?: Partial<Options>): EditorTuple {
  const context = useContext();
  const parentRef = useRef<Element>();
  const editorRef = useRef<EditorView>();

  useEffect(() => {
    editorRef.current = new EditorView({
      state: EditorState.create({
        extensions: [
          basicSetup,
          keymap.of([defaultTabBinding]),
          javascript(),
          oneDark,
          EditorView.updateListener.of((view: ViewUpdate) => {
            view.docChanged &&
              options?.onChange &&
              options.onChange(editorRef.current);
          }),
        ],
      }),
      root: context.host,
      parent: parentRef.current,
    });

    return () => editorRef.current.destroy();
  }, []);

  return [parentRef, editorRef];
}
