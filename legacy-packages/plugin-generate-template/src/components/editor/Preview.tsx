// @ts-ignore
import ejs from 'ejs/ejs.min.js';
import { observer } from 'mobx-react-lite';
import { FunctionalComponent } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { identity } from 'ramda';
import { ERDEditorContext } from 'vuerd';

import { Container } from '@/components/editor/TemplateEditor.styled';
import { hljs } from '@/config/highlight.config';
import { camelCase, createState, pascalCase, snakeCase } from '@/core/helper';
import { useContext } from '@/hooks/useContext';

interface Data {
  state: Partial<
    Pick<
      ERDEditorContext['store'],
      'canvasState' | 'tableState' | 'memoState' | 'relationshipState'
    >
  >;
  helper: any;
  dataTypes: Array<{ name: string; type: string }>;
}

interface Props {
  width: number;
  value: string;
}

const Preview: FunctionalComponent<Partial<Props>> = ({
  width = 0,
  value = '',
}) => {
  const [code, setCode] = useState('');
  const dataRef = useRef<Data>({
    state: {},
    helper: {
      camelCase,
      snakeCase,
      pascalCase,
    },
    dataTypes: [],
  });
  const { api, stores } = useContext();

  useEffect(() => {
    dataRef.current.state = createState(api.store);
    dataRef.current.dataTypes = stores.dataType.dataTypes.map(dataType => ({
      name: dataType.name,
      type: dataType.primitiveType,
    }));
  }, []);

  useEffect(() => {
    dataRef.current.dataTypes = stores.dataType.dataTypes.map(dataType => ({
      name: dataType.name,
      type: dataType.primitiveType,
    }));
  }, [stores.dataType.dataTypes.length]);

  useEffect(() => {
    if (!value.trim()) {
      setCode('');
      return;
    }

    try {
      const result = ejs.render(
        `<%= ${value} %>`,
        {
          DATA: dataRef.current,
        },
        { escape: identity }
      );
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

export default observer(Preview);
