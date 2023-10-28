import { SchemaV3Constants } from '@dineug/erd-editor-schema';
import { FC, html } from '@dineug/r-html';

import Icon from '@/components/primitives/icon/Icon';
import { bHas } from '@/utils/bit';

import * as styles from './ColumnKey.styles';

export type ColumnKeyProps = {
  keys: number;
};

const ColumnKey: FC<ColumnKeyProps> = (props, ctx) => {
  const className = () => {
    const isPrimaryKey = bHas(
      props.keys,
      SchemaV3Constants.ColumnUIKey.primaryKey
    );
    const isForeignKey = bHas(
      props.keys,
      SchemaV3Constants.ColumnUIKey.foreignKey
    );

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
    />
  `;
};

export default ColumnKey;
