import { SchemaV3Constants } from '@dineug/erd-editor-schema';
import { FC, html } from '@dineug/r-html';

import { COLUMN_NOT_NULL_WIDTH } from '@/constants/layout';
import { bHas } from '@/utils/bit';

import * as styles from './ColumnNotNull.styles';

export type ColumnNotNullProps = {
  focus: boolean;
  options: number;
};

const ColumnNotNull: FC<ColumnNotNullProps> = (props, ctx) => {
  return () =>
    html`
      <div
        class=${[styles.notNull, { focus: props.focus }]}
        style=${{
          width: `${COLUMN_NOT_NULL_WIDTH}px`,
          'min-width': `${COLUMN_NOT_NULL_WIDTH}px`,
        }}
        title="Not Null"
      >
        ${bHas(props.options, SchemaV3Constants.ColumnOption.notNull)
          ? 'N-N'
          : 'NULL'}
      </div>
    `;
};

export default ColumnNotNull;
