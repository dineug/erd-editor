import { Table } from '@@types/engine/store/table.state';
import { Move } from '@/internal-types/event.helper';
import {
  defineComponent,
  html,
  FunctionalComponent,
} from '@dineug/lit-observable';
import { styleMap } from 'lit-html/directives/style-map';
import { classMap } from 'lit-html/directives/class-map';
import { useContext } from '@/core/hooks/context.hook';
import { selectTable$, moveTable } from '@/engine/command/table.cmd.helper';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-high-level-table': HighLevelTableElement;
  }
}

export interface HighLevelTableProps {
  table: Table;
}

export interface HighLevelTableElement
  extends HighLevelTableProps,
    HTMLElement {}

const HighLevelTable: FunctionalComponent<
  HighLevelTableProps,
  HighLevelTableElement
> = (props, ctx) => {
  const contextRef = useContext(ctx);

  const getFontSize = () => {
    const { zoomLevel } = contextRef.value.store.canvasState;
    let fontSize = 25;

    if (zoomLevel > 0.6) {
      fontSize = 25;
    } else if (zoomLevel > 0.5) {
      fontSize = 30;
    } else if (zoomLevel > 0.4) {
      fontSize = 35;
    } else if (zoomLevel > 0.3) {
      fontSize = 40;
    } else {
      fontSize = 45;
    }

    return fontSize;
  };

  const onMove = ({ event, movementX, movementY }: Move) => {
    event.type === 'mousemove' && event.preventDefault();
    const { store } = contextRef.value;
    store.dispatch(
      moveTable(
        store,
        event.ctrlKey || event.metaKey,
        movementX,
        movementY,
        props.table.id
      )
    );
  };

  const onMoveStart = (event: MouseEvent | TouchEvent) => {
    const el = event.target as HTMLElement;
    const { store, globalEvent } = contextRef.value;
    const { drag$ } = globalEvent;

    if (!el.closest('.vuerd-button') && !el.closest('vuerd-input')) {
      drag$.subscribe(onMove);
    }
    if (!el.closest('vuerd-input-edit')) {
      store.dispatch(
        selectTable$(store, event.ctrlKey || event.metaKey, props.table.id)
      );
    }
  };

  return () => {
    const { table } = props;
    const { ui } = table;
    table.maxWidthColumn();

    return html`
      <div
        class=${classMap({
          'vuerd-table': true,
          active: ui.active,
        })}
        style=${styleMap({
          top: `${ui.top}px`,
          left: `${ui.left}px`,
          zIndex: `${ui.zIndex}`,
          width: `${table.width()}px`,
          height: `${table.height()}px`,
        })}
        @mousedown=${onMoveStart}
        @touchstart=${onMoveStart}
      >
        <div
          class="vuerd-high-level-table vuerd-scrollbar"
          style=${styleMap({
            fontSize: `${getFontSize()}px`,
          })}
        >
          ${table.name}
        </div>
      </div>
    `;
  };
};

defineComponent('vuerd-high-level-table', {
  observedProps: ['table'],
  shadow: false,
  render: HighLevelTable,
});
