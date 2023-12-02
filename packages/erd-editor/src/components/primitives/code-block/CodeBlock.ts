import { FC, html, innerHTML } from '@dineug/r-html';

import Icon from '@/components/primitives/icon/Icon';

import * as styles from './CodeBlock.styles';

export type CodeBlockProps = {
  value: string;
  onCopy?: (value: string) => void;
};

const CodeBlock: FC<CodeBlockProps> = (props, ctx) => {
  const handleCopy = () => {
    props.onCopy?.(props.value);
  };

  return () => html`
    <div class=${styles.root}>
      <pre class=${['scrollbar', styles.code]}>${innerHTML(props.value)}</pre>
      <div class=${styles.clipboard} title="Copy" @click=${handleCopy}>
        <${Icon} prefix="far" name="copy" useTransition=${true} />
      </div>
    </div>
  `;
};

export default CodeBlock;
