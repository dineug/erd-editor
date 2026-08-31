import { FC } from '@dineug/r-html';

import { COLUMN_NOT_NULL_WIDTH } from '@/constants/layout';
import { ColumnOption } from '@/constants/schema';
import { bHas } from '@/utils/bit';

import * as styles from './ColumnNotNull.styles';

export type ColumnNotNullProps = {
  focus?: boolean;
  options: number;
};

const ColumnNotNull: FC<ColumnNotNullProps> = (props, ctx) => {
  return () => (
    <div
      class={[styles.notNull, { focus: props.focus }]}
      style={{
        width: `${COLUMN_NOT_NULL_WIDTH}px`,
        'min-width': `${COLUMN_NOT_NULL_WIDTH}px`,
      }}
      title="Not Null"
      bool:data-focus-border-bottom={props.focus}
    >
      {bHas(props.options, ColumnOption.notNull) ? 'N-N' : 'NULL'}
    </div>
  );
};

export default ColumnNotNull;
