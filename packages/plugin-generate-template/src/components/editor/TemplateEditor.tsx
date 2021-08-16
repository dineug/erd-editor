import { EditorView } from '@codemirror/view';
import { FunctionalComponent } from 'preact';
import { useEffect } from 'preact/hooks';

import { Container } from '@/components/editor/TemplateEditor.styled';
import { useEditor } from '@/hooks/useEditor';

interface Props {
  value: string;
  width: number;
  onChange(editor: EditorView): void;
}

const TemplateEditor: FunctionalComponent<Partial<Props>> = ({
  value = '',
  width = 0,
  onChange,
}) => {
  const [parentRef, editorRef] = useEditor({ onChange });

  const setEditorValue = (value: string) => {
    const editor = editorRef.current;
    const text = editor.state.doc.toString();

    editor.dispatch({
      changes: [
        { from: 0, to: text.length, insert: '' },
        { from: 0, insert: value },
      ],
    });
  };

  useEffect(() => {
    setEditorValue(value);
  }, [value]);

  return (
    <Container
      className="scrollbar"
      style={{ width: width ? `${width}px` : '' }}
      ref={parentRef}
    />
  );
};

export default TemplateEditor;
