import { FC, html } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import ColumnOption from '@/components/erd/canvas/table/column/column-option/ColumnOption';
import Icon from '@/components/primitives/icon/Icon';
import TextInput from '@/components/primitives/text-input/TextInput';
import { COLUMN_UNIQUE_WIDTH } from '@/constants/layout';
import {
  changeIndexNameAction,
  removeIndexAction,
} from '@/engine/modules/index/atom.actions';
import { changeIndexUniqueAction$ } from '@/engine/modules/index/generator.actions';
import { attachSharedTag$ } from '@/engine/tag';
import { Index } from '@/internal-types';

import * as styles from './IndexesIndex.styles';

export type IndexesIndexProps = {
  index: Index;
  selected: boolean;
  onSelect: (index: Index | null) => void;
};

const IndexesIndex: FC<IndexesIndexProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const handleSelect = () => {
    props.onSelect(props.index);
  };

  const handleRemoveIndex = (event: MouseEvent) => {
    event.stopPropagation();
    props.onSelect(null);

    const { store } = app.value;
    store.dispatch(attachSharedTag$(removeIndexAction({ id: props.index.id })));
  };

  const handleChangeUniqueIndex = () => {
    const { store } = app.value;
    store.dispatch(attachSharedTag$(changeIndexUniqueAction$(props.index.id)));
  };

  const handleChangeIndexName = (event: InputEvent) => {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;

    const { store } = app.value;
    store.dispatch(
      attachSharedTag$(
        changeIndexNameAction({
          id: props.index.id,
          tableId: props.index.tableId,
          value: input.value,
        })
      )
    );
  };

  return () => {
    const { index } = props;

    return html`
      <div
        class=${[styles.row, { selected: props.selected }]}
        @click=${handleSelect}
      >
        <div class="column-col" @click=${handleChangeUniqueIndex}>
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
            .onInput=${handleChangeIndexName}
          />
        </div>
        <${Icon}
          class=${styles.iconButton}
          size=${12}
          name="xmark"
          title="Remove"
          .onClick=${handleRemoveIndex}
        />
      </div>
    `;
  };
};

export default IndexesIndex;
