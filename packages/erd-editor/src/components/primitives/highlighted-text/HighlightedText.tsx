import { FC } from '@dineug/r-html';

import { findAll, FindAllArgs } from '@/utils/highlightWords';

import * as styles from './HighlightedText.styles';

export type HighlightedTextProps = FindAllArgs;

const HighlightedText: FC<HighlightedTextProps> = (props, ctx) => {
  return () => {
    const chunks = findAll(props);

    return chunks.map(({ end, highlight, start }) => {
      const text = props.textToHighlight.substring(start, end);
      return highlight ? <span class={styles.highlighted}>{text}</span> : text;
    });
  };
};

export default HighlightedText;
