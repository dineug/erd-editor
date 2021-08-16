// @ts-ignore
import ejs from 'ejs/ejs.min.js';
import { FunctionalComponent } from 'preact';

import { Container } from '@/components/editor/TemplateEditor.styled';

interface Props {
  width: number;
}

const Preview: FunctionalComponent<Partial<Props>> = ({ width = 0 }) => {
  return (
    <Container style={{ width: width ? `${width}px` : '' }}>Preview</Container>
  );
};

export default Preview;
