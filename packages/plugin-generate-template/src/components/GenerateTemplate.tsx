import { FunctionalComponent } from 'preact';
import { useEffect } from 'preact/hooks';
// @ts-ignore
import ejs from 'ejs/ejs.min.js';
import styled from 'styled-components';
import { useEditor } from '@/core/hooks/useEditor';

const Container = styled.div`
  background-color: var(--vuerd-color-canvas);
  height: 100%;
`;

const GenerateTemplate: FunctionalComponent = () => {
  const [parentRef, editorRef] = useEditor();

  useEffect(() => {
    const editor = editorRef.current;
    console.log(editor);
    setInterval(() => {
      const data = editor.state.doc.toJSON().join('\n');
      console.log(data);
      const people = ['geddy', 'neil', 'alex'];
      const html = ejs.render(data, { people });
      console.log(html);
    }, 1000);
  });

  return <Container ref={parentRef} />;
};

export default GenerateTemplate;
