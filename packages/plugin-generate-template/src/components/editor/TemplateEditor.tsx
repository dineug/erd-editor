import { FunctionalComponent } from 'preact';
import { useEffect } from 'preact/hooks';
import styled from 'styled-components';
import { useEditor } from '@/core/hooks/useEditor';

interface Props {}

const Container = styled.div`
  width: 100%;
  height: 100%;
  background-color: var(--vuerd-color-canvas);
`;

const TemplateEditor: FunctionalComponent<Props> = () => {
  const [parentRef, editorRef] = useEditor();

  useEffect(() => {
    const editor = editorRef.current;
    console.log(editor);
    // setInterval(() => {
    //   const data = editor.state.doc.toJSON().join('\n');
    //   console.log(data);
    // }, 1000);
  });

  return <Container ref={parentRef} />;
};

export default TemplateEditor;
