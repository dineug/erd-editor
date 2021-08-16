// @ts-ignore
import ejs from 'ejs/ejs.min.js';
// @ts-ignore
import ejsLint from 'ejs-lint';
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
      const error = ejsLint(`<%= ${value} %>`);
      let msg = '';

      if (error) {
        msg = hljs.highlightAuto(String(error)).value;
      } else {
        msg = hljs.highlightAuto(String(e)).value;
      }

      setCode(msg);
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
