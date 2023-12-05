import { FC, html } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import ColumnOption from '@/components/erd/canvas/table/column/column-option/ColumnOption';
import Icon from '@/components/primitives/icon/Icon';
import TextInput from '@/components/primitives/text-input/TextInput';
import { COLUMN_UNIQUE_WIDTH } from '@/constants/layout';
import { Index } from '@/internal-types';

import * as styles from './IndexesIndex.styles';

export type IndexesIndexProps = {
  index: Index;
  selected: boolean;
  onSelect: (index: Index | null) => void;
};

const IndexesIndex: FC<IndexesIndexProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const handleRemoveIndex = (event: MouseEvent, index: Index) => {
    // TODO: remove index
    event.stopPropagation();
    props.onSelect(null);
    console.log('handleRemoveIndex', index);
  };

  const handleChangeUniqueIndex = (index: Index) => {
    // TODO: change unique index
    console.log('handleChangeUniqueIndex', index);
  };

  const handleChangeIndexName = (event: InputEvent, index: Index) => {
    // TODO: change index name
    console.log('handleChangeIndexName', event, index);
  };

  return () => {
    const { index } = props;

    return html`
      <div
        class=${[styles.row, { selected: props.selected }]}
        @click=${() => props.onSelect(index)}
      >
        <div class="column-col" @click=${() => handleChangeUniqueIndex(index)}>
          <${ColumnOption}
            class=${styles.unique}
            checked=${index.unique}
            width=${COLUMN_UNIQUE_WIDTH}
            text="UQ"
            title="Unique"
          />
        </div>
        <div class=${['column-col', styles.input]}>
          <${TextInput}
            class=${styles.input}
            placeholder="name"
            value=${index.name}
            .onInput=${(event: InputEvent) =>
              handleChangeIndexName(event, index)}
          />
        </div>
        <${Icon}
          class=${styles.iconButton}
          size=${12}
          name="xmark"
          title="Remove"
          .onClick=${(event: MouseEvent) => handleRemoveIndex(event, index)}
        />
      </div>
    `;
  };
};

export default IndexesIndex;
