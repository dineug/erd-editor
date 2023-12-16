import { createRef, FC, html, onUpdated, ref, repeat } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import ColumnOption from '@/components/erd/canvas/table/column/column-option/ColumnOption';
import Icon from '@/components/primitives/icon/Icon';
import { OrderType } from '@/constants/schema';
import {
  changeIndexColumnOrderTypeAction$,
  moveIndexColumnAction$,
} from '@/engine/modules/index-column/generator.actions';
import { attachSharedTag$ } from '@/engine/tag';
import { Index, IndexColumn } from '@/internal-types';
import { query } from '@/utils/collection/query';
import { onPrevent } from '@/utils/domEvent';
import { FlipAnimation } from '@/utils/flipAnimation';
import { fromShadowDraggable } from '@/utils/rx-operators/fromShadowDraggable';
import { toOrderName } from '@/utils/schema-sql/utils';

import * as styles from './IndexesColumn.styles';

export type IndexesColumnProps = {
  index: Index;
};

const IndexesColumn: FC<IndexesColumnProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const root = createRef<HTMLDivElement>();
  const flipAnimation = new FlipAnimation(
    root,
    `.${styles.row}`,
    'index-column-order-move'
  );

  const toOrderTitle = (orderType: number) => {
    switch (orderType) {
      case OrderType.ASC:
        return 'Ascending';
      case OrderType.DESC:
        return 'Descending';
      default:
        return '';
    }
  };

  const handleMove = (id: string, targetId: string) => {
    const { store } = app.value;

    if (id !== targetId) {
      flipAnimation.snapshot();
      store.dispatch(attachSharedTag$(moveIndexColumnAction$(id, targetId)));
    }
  };

  const handleDragstart = (event: DragEvent) => {
    const $root = root.value;
    const $target = event.target as HTMLElement | null;
    if (!$root || !$target) return;

    const id = $target.dataset.id as string;
    const elements = Array.from<HTMLElement>(
      $root.querySelectorAll(`.${styles.row}`)
    );
    elements.forEach(el => el.classList.add('none-hover'));
    $target.classList.add('draggable');

    fromShadowDraggable(elements).subscribe({
      next: targetId => {
        handleMove(id, targetId);
      },
      complete: () => {
        $target.classList.remove('draggable');
        elements.forEach(el => el.classList.remove('none-hover'));
      },
    });
  };

  const handleChangeOrderType = (indexColumn: IndexColumn) => {
    const { store } = app.value;
    store.dispatch(
      attachSharedTag$(changeIndexColumnOrderTypeAction$(indexColumn.id))
    );
  };

  onUpdated(() => flipAnimation.play());

  return () => {
    const { store } = app.value;
    const { collections } = store.state;

    const indexColumns = query(collections)
      .collection('indexColumnEntities')
      .selectByIds(props.index.indexColumnIds)
      .map(indexColumn => ({
        ...indexColumn,
        column: query(collections)
          .collection('tableColumnEntities')
          .selectById(indexColumn.columnId),
      }));

    return html`
      <div
        class=${styles.root}
        ${ref(root)}
        @dragenter=${onPrevent}
        @dragover=${onPrevent}
      >
        ${repeat(
          indexColumns,
          indexColumn => indexColumn.id,
          indexColumn => html`
            <div
              class=${styles.row}
              draggable="true"
              data-id=${indexColumn.id}
              @dragstart=${handleDragstart}
            >
              <${Icon} class=${'column-col'} name="bars" size=${14} />
              <div
                class="column-col"
                @click=${() => handleChangeOrderType(indexColumn)}
              >
                <${ColumnOption}
                  class=${styles.orderType}
                  checked=${true}
                  width=${40}
                  text=${toOrderName(indexColumn.orderType)}
                  title=${toOrderTitle(indexColumn.orderType)}
                />
              </div>
              <div class="column-col">${indexColumn.column?.name}</div>
            </div>
          `
        )}
      </div>
    `;
  };
};

export default IndexesColumn;
