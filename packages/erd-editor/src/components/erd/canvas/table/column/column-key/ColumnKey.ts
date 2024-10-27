import { FC, html } from '@dineug/r-html';

import Icon from '@/components/primitives/icon/Icon';
import { ColumnUIKey } from '@/constants/schema';
import { bHas } from '@/utils/bit';

import * as styles from './ColumnKey.styles';

export type ColumnKeyProps = {
  keys: number;
  onMouseenter?: (event: MouseEvent) => void;
  onMouseleave?: (event: MouseEvent) => void;
};

const ColumnKey: FC<ColumnKeyProps> = (props, ctx) => {
  const className = () => {
    const isPrimaryKey = bHas(props.keys, ColumnUIKey.primaryKey);
    const isForeignKey = bHas(props.keys, ColumnUIKey.foreignKey);

    return {
      pk: isPrimaryKey && !isForeignKey,
      fk: !isPrimaryKey && isForeignKey,
      pfk: isPrimaryKey && isForeignKey,
    };
  };

  return () => html`
    <${Icon}
      class=${['column-col', styles.key, className()]}
      size=${12}
      name="key"
      .onMouseenter=${props.onMouseenter}
      .onMouseleave=${props.onMouseleave}
    />
  `;
};

export default ColumnKey;
