import {
  defineComponent,
  FunctionalComponent,
  html,
  observable,
  queryAll,
  updated,
} from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { repeat } from 'lit-html/directives/repeat';

import { FlipAnimation } from '@/core/flipAnimation';
import { onPreventDefault } from '@/core/helper/dom.helper';
import { useContext } from '@/core/hooks/context.hook';
import { fromShadowDraggable } from '@/core/observable/fromShadowDraggable';
import {
  changeRelationshipDataTypeSync,
  changeRelationshipOptimization,
  moveColumnOrder,
} from '@/engine/command/canvas.cmd.helper';
import { relationshipSort } from '@/engine/store/helper/relationship.helper';
import { recalculatingTableWidth } from '@/engine/store/helper/table.helper';
import { ColumnType } from '@@types/engine/store/canvas.state';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-setting-drawer': SettingDrawerElement;
  }
}

export interface SettingDrawerProps {
  width: number;
  visible: boolean;
}

export interface SettingDrawerElement extends SettingDrawerProps, HTMLElement {}

interface SettingDrawerState {
  currentColumnType: ColumnType | null;
}

const SettingDrawer: FunctionalComponent<
  SettingDrawerProps,
  SettingDrawerElement
> = (props, ctx) => {
  const contextRef = useContext(ctx);
  const state = observable<SettingDrawerState>({
    currentColumnType: null,
  });
  const columnsOrderRef = queryAll<Array<HTMLElement>>('.vuerd-column-order');
  const flipAnimation = new FlipAnimation(
    ctx.shadowRoot ? ctx.shadowRoot : ctx,
    '.vuerd-column-order',
    'vuerd-column-order-move'
  );

  const onClose = () => ctx.dispatchEvent(new CustomEvent('close'));

  const onChangeRelationshipDataTypeSync = (event: Event) => {
    const checkbox = event.target as HTMLInputElement;
    const { store } = contextRef.value;
    store.dispatch(changeRelationshipDataTypeSync(checkbox.checked));
  };

  const onChangeRelationshipOptimization = (event: Event) => {
    const checkbox = event.target as HTMLInputElement;
    const { store } = contextRef.value;
    store.dispatch(changeRelationshipOptimization(checkbox.checked));
  };

  const onMoveColumnOrder = (
    currentColumnType: ColumnType,
    targetColumnType: ColumnType
  ) => {
    const { store } = contextRef.value;

    if (currentColumnType && currentColumnType !== targetColumnType) {
      flipAnimation.snapshot();
      store.dispatch(moveColumnOrder(currentColumnType, targetColumnType));
    }
  };

  const onDragstartColumnOrder = (currentColumnType: ColumnType) => {
    state.currentColumnType = currentColumnType;

    columnsOrderRef.value.forEach(el => el.classList.add('none-hover'));

    fromShadowDraggable(columnsOrderRef.value).subscribe({
      next: id => onMoveColumnOrder(currentColumnType, id as ColumnType),
      complete: () => {
        state.currentColumnType = null;
        columnsOrderRef.value.forEach(el => el.classList.remove('none-hover'));
      },
    });
  };

  const onSyncTableWidth = () => {
    const {
      store: {
        tableState: { tables },
        relationshipState: { relationships },
      },
      helper,
    } = contextRef.value;

    recalculatingTableWidth(tables, helper);
    relationshipSort(tables, relationships);
  };

  updated(() => flipAnimation.play());

  return () => {
    const {
      canvasState: { setting },
      editorState: { readonly },
    } = contextRef.value.store;

    return html`
      <vuerd-drawer
        name="Setting"
        .width=${props.width}
        .visible=${props.visible}
        @close=${onClose}
      >
        <table class="vuerd-setting-drawer">
          <colgroup>
            <col width="190px" />
          </colgroup>
          <tbody>
            <tr>
              <td>Relationship DataType Sync</td>
              <td>
                <input
                  type="checkbox"
                  ?checked=${setting.relationshipDataTypeSync}
                  ?disabled=${readonly}
                  @change=${onChangeRelationshipDataTypeSync}
                />
              </td>
            </tr>
            <tr>
              <td>ColumnType Order</td>
              <td @dragenter=${onPreventDefault} @dragover=${onPreventDefault}>
                ${repeat(
                  setting.columnOrder,
                  columnType => columnType,
                  columnType => html`
                    <div
                      class=${classMap({
                        'vuerd-column-order': true,
                        draggable: state.currentColumnType === columnType,
                      })}
                      data-id=${columnType}
                      draggable="true"
                      @dragstart=${() => onDragstartColumnOrder(columnType)}
                    >
                      ${columnType}
                    </div>
                  `
                )}
              </td>
            </tr>
            <tr>
              <td>Recalculating table width</td>
              <td>
                <div
                  class="vuerd-recalculating-table-width-button"
                  @click=${onSyncTableWidth}
                >
                  <span>Sync</span>
                  <vuerd-icon name="sync-alt" size="12"></vuerd-icon>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </vuerd-drawer>
    `;
  };
};

defineComponent('vuerd-setting-drawer', {
  observedProps: ['width', 'visible'],
  shadow: false,
  render: SettingDrawer,
});
