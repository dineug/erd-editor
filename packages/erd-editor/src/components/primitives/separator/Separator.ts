import { FC, html } from '@dineug/r-html';

import * as styles from './Separator.styles';

export type SeparatorProps = {
  space?: number;
  padding?: number;
};

const Separator: FC<SeparatorProps> = (props, ctx) => {
  return () =>
    html`
      <div
        style=${{
          'padding-left': `${props.padding ?? 0}px`,
          'padding-right': `${props.padding ?? 0}px`,
        }}
      >
        <div
          class=${[styles.separator, styles.horizontal]}
          style=${{
            'margin-top': `${props.space ?? 0}px`,
            'margin-bottom': `${props.space ?? 0}px`,
          }}
        ></div>
      </div>
    `;
};

export default Separator;
