import { FunctionalComponent } from 'preact';
import { useEffect } from 'preact/hooks';

import { Container } from '@/components/editor/TemplateEditor.styled';
import { useEditor } from '@/hooks/useEditor';

interface Props {}

const TemplateEditor: FunctionalComponent<Props> = () => {
  const [parentRef, editorRef] = useEditor();

  useEffect(() => {
    const editor = editorRef.current;
    console.log(editor);
    // setInterval(() => {
    //   const data = editor.state.doc.toJSON().join('\n');
    //   console.log(data);
    // }, 1000);
  }, []);

  return <Container ref={parentRef} />;
};

export default TemplateEditor;
