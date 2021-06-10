import { basicSetup, EditorState } from '@codemirror/basic-setup';
import { defaultTabBinding } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap } from '@codemirror/view';
import { Ref } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

import { useContext } from '@/hooks/useContext';

type EditorTuple = readonly [Ref<any>, { current: EditorView }];

export function useEditor(): EditorTuple {
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
        ],
      }),
      root: context.host,
      parent: parentRef.current,
    });

    return () => editorRef.current.destroy();
  });

  return [parentRef, editorRef];
}
