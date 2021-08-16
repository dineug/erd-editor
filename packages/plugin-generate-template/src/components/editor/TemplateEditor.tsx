import { FunctionalComponent } from 'preact';
import { useEffect } from 'preact/hooks';

import { Container } from '@/components/editor/TemplateEditor.styled';
import { useEditor } from '@/hooks/useEditor';

interface Props {
  value: string;
  width: number;
}

const TemplateEditor: FunctionalComponent<Partial<Props>> = ({
  value = '',
  width = 0,
}) => {
  const [parentRef, editorRef] = useEditor();

  useEffect(() => {
    const editor = editorRef.current;
    const text = editor.state.doc.toString();

    editor.dispatch({
      changes: [
        { from: 0, to: text.length, insert: '' },
        { from: 0, insert: value },
      ],
    });
  }, [value]);

  return (
    <Container style={{ width: width ? `${width}px` : '' }} ref={parentRef} />
  );
};

export default TemplateEditor;
