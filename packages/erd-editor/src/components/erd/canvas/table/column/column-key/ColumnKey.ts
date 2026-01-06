import { FC, html } from '@dineug/r-html';

import Icon from '@/components/primitives/icon/Icon';
import { ColumnUIKey } from '@/constants/schema';
import { bHas } from '@/utils/bit';

import * as styles from './ColumnKey.styles';

export type ColumnKeyProps = {
  keys: number;
  alternateKeyLabels?: string[];
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

  const hasAnyKey = () => {
    return (
      props.keys !== 0 ||
      (props.alternateKeyLabels && props.alternateKeyLabels.length > 0)
    );
  };

  return () => {
    if (!hasAnyKey()) {
      return html`<div class="column-col" style="width: 12px;"></div>`;
    }

    return html`
      <div class=${['column-col', styles.keyContainer]}>
        ${props.keys !== 0
          ? html`
              <${Icon}
                class=${[styles.key, className()]}
                size=${12}
                name="key"
                .onMouseenter=${props.onMouseenter}
                .onMouseleave=${props.onMouseleave}
              />
            `
          : null}
        ${props.alternateKeyLabels && props.alternateKeyLabels.length > 0
          ? html`
              <span class=${styles.akLabel}>
                ${props.alternateKeyLabels.join(', ')}
              </span>
            `
          : null}
      </div>
    `;
  };
};

export default ColumnKey;
