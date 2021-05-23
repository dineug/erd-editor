import { Ref } from 'preact';
import { useRef, useEffect } from 'preact/hooks';
import { EditorState, basicSetup } from '@codemirror/basic-setup';
import { EditorView, keymap } from '@codemirror/view';
import { defaultTabBinding } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { useContext } from './useContext';

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
