// @ts-ignore
import ejs from 'ejs/ejs.min.js';
import { FunctionalComponent } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { identity } from 'ramda';

import { Container } from '@/components/editor/TemplateEditor.styled';
import { hljs } from '@/config/highlight.config';

interface Props {
  width: number;
  value: string;
}

const Preview: FunctionalComponent<Partial<Props>> = ({
  width = 0,
  value = '',
}) => {
  const [code, setCode] = useState('');

  useEffect(() => {
    try {
      const result = ejs.render(`<%= ${value} %>`, {}, { escape: identity });
      const html = hljs.highlightAuto(result).value;

      setCode(html);
    } catch (e) {
      const html = hljs.highlightAuto(String(e)).value;
      setCode(html);
    }
  }, [value]);

  return (
    <Container
      className="hljs scrollbar"
      style={{ width: width ? `${width}px` : '' }}
      dangerouslySetInnerHTML={{ __html: code }}
      contentEditable
      spellCheck={false}
    />
  );
};

export default Preview;
