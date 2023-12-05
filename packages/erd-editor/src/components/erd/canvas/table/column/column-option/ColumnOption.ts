import { FC, html } from '@dineug/r-html';

import * as styles from './ColumnOption.styles';

export type ColumnOptionProps = {
  class?: any;
  focus: boolean;
  width: number;
  checked: boolean;
  text: string;
  title?: string;
};

const ColumnOption: FC<ColumnOptionProps> = (props, ctx) => {
  return () => html`
    <div
      class=${[
        styles.option,
        { focus: props.focus, checked: props.checked },
        props.class,
      ]}
      style=${{
        width: `${props.width}px`,
        'min-width': `${props.width}px`,
      }}
      title=${props.title}
      ?data-focus-border-bottom=${props.focus}
    >
      ${props.text}
    </div>
  `;
};

export default ColumnOption;
