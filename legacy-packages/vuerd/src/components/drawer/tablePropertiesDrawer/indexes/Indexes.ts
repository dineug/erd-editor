import './IndexAddColumn';
import './IndexColumn';

import {
  beforeMount,
  defineComponent,
  FunctionalComponent,
  html,
  watch,
} from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { repeat } from 'lit-html/directives/repeat';

import { onPreventDefault } from '@/core/helper/dom.helper';
import { useContext } from '@/core/hooks/context.hook';
import { useTooltip } from '@/core/hooks/tooltip.hook';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import {
  addIndex,
  changeIndexName,
  changeIndexUnique,
  removeIndex,
} from '@/engine/command/index.cmd.helper';
import { Index, Table } from '@@types/engine/store/table.state';

import { IndexStyle } from './index.style';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-indexes': IndexesElement;
  }
}

export interface IndexesProps {
  table: Table | null;
}

export interface IndexesElement extends IndexesProps, HTMLElement {}

const Indexes: FunctionalComponent<IndexesProps, IndexesElement> = (
  props,
  ctx
) => {
  const contextRef = useContext(ctx);
  const { resetTooltip } = useTooltip(
    ['.vuerd-indexes-button', '.vuerd-index-unique'],
    ctx
  );
  const { unmountedGroup } = useUnmounted();

  const getIndexes = () => {
    const { indexes } = contextRef.value.store.tableState;
    return indexes.filter(index => index.tableId === props.table?.id);
  };

  const onAddIndex = () => {
    if (!props.table) return;
    const { store } = contextRef.value;
    store.dispatch(addIndex(props.table.id));
  };

  const onRemoveIndex = (index: Index) => {
    const { store } = contextRef.value;
    store.dispatch(removeIndex([index.id]));
  };

  const onChangeIndexUnique = (index: Index) => {
    const { store } = contextRef.value;
    store.dispatch(changeIndexUnique(index.id, !index.unique));
  };

  const onInput = (event: Event, index: Index) => {
    const { store } = contextRef.value;
    const input = event.target as HTMLInputElement;
    store.dispatch(changeIndexName(index.id, input.value));
  };

  beforeMount(() => {
    const { indexes } = contextRef.value.store.tableState;
    unmountedGroup.push(watch(indexes, () => resetTooltip()));
  });

  return () => {
    const {
      store: {
        editorState: { readonly },
      },
    } = contextRef.value;
    const { table } = props;
    const indexes = getIndexes();

    return table
      ? html`
          <div class="vuerd-indexes">
            <div style="display: inline-block;">
              <vuerd-icon
                class="vuerd-button vuerd-indexes-button"
                data-tippy-content="New Index"
                name="plus"
                size="12"
                @click=${onAddIndex}
              ></vuerd-icon>
            </div>
            <div class="vuerd-scrollbar" style="height: 100%; overflow: auto;">
              ${repeat(
                indexes,
                index => index.id,
                index => html`
                  <div class="vuerd-index">
                    <div style="display: inline-block;">
                      <vuerd-icon
                        class="vuerd-button vuerd-indexes-button"
                        data-tippy-content="Remove Index"
                        name="times"
                        size="9"
                        @click=${() => onRemoveIndex(index)}
                      ></vuerd-icon>
                    </div>
                    <div
                      class=${classMap({
                        'vuerd-index-unique': true,
                        checked: index.unique,
                      })}
                      style="width: 22px;"
                      data-tippy-content="Unique"
                      @click=${() => onChangeIndexUnique(index)}
                    >
                      UQ
                    </div>
                    <input
                      type="text"
                      placeholder="index name"
                      spellcheck="false"
                      ?disabled=${readonly}
                      .value=${index.name}
                      @input=${(event: Event) => onInput(event, index)}
                    />
                    <vuerd-index-add-column
                      .table=${table}
                      .indexId=${index.id}
                    ></vuerd-index-add-column>
                    <vuerd-index-column
                      .table=${table}
                      .indexId=${index.id}
                      @dragenter=${onPreventDefault}
                      @dragover=${onPreventDefault}
                    ></vuerd-index-column>
                  </div>
                `
              )}
            </div>
          </div>
        `
      : null;
  };
};

defineComponent('vuerd-indexes', {
  observedProps: [
    {
      name: 'table',
      default: null,
    },
  ],
  styleMap: {
    width: '100%',
    height: '100%',
  },
  style: IndexStyle,
  render: Indexes,
});
