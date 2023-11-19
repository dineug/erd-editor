import { FC, html } from '@dineug/r-html';
import { findAll } from 'highlight-words-core';

import * as styles from './HighlightedText.styles';

export type HighlightedTextProps = Parameters<typeof findAll>[0] & {
  searchWords: string[];
  textToHighlight: string;
};

const HighlightedText: FC<HighlightedTextProps> = (props, ctx) => {
  return () => {
    const chunks = findAll(props);

    return chunks.map(({ end, highlight, start }) => {
      const text = props.textToHighlight.substring(start, end);
      return highlight
        ? html`<span class=${styles.highlighted}>${text}</span>`
        : text;
    });
  };
};

export default HighlightedText;
