import './GridEditorProvider';
import './filter/Filter';

import {
  defineComponent,
  FunctionalComponent,
  html,
} from '@vuerd/lit-observable';

import { GridContext } from '@/extensions/panels/grid/core/gridContext';
import { useGrid } from '@/extensions/panels/grid/hooks/grid.hook';
import { useGridKeymap } from '@/extensions/panels/grid/hooks/gridKeymap.hook';
import { useKeydown } from '@/extensions/panels/grid/hooks/keydown.hook';
import { ERDEditorContext } from '@@types/index';

import { IndexStyle } from './index.style';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-grid-editor': GridEditorElement;
  }
}

export interface GridEditorProps {
  width: number;
  height: number;
}

export interface GridEditorElement extends GridEditorProps, HTMLElement {
  api: ERDEditorContext;
  focus(): void;
}

const GridEditor: FunctionalComponent<GridEditorProps, GridEditorElement> = (
  props,
  ctx
) => {
  const { keydown$ } = useKeydown(ctx);
  const gridRef = useGrid(props, ctx, keydown$);
  useGridKeymap(ctx);

  const onCloseFilter = () => {
    const { store, command } = ctx.api;
    const { filterActiveEnd$ } = command.editor;
    store.dispatch(filterActiveEnd$());
  };

  const onOutside = (event: MouseEvent | TouchEvent) => {
    const el = event.target as HTMLElement;
    const { store, command } = ctx.api;
    const { editFilterEnd } = command.editor;

    if (!el.closest('.vuerd-filter')) {
      onCloseFilter();
    }

    if (
      !el.closest('.vuerd-filter-radio-editor') &&
      !el.closest('.vuerd-filter-input')
    ) {
      store.dispatch(editFilterEnd());
    }
  };

  ctx.focus = () => gridRef.value.focus(0, 'tableName');

  return () => {
    const { filterState } = ctx.api.store.editorState;
    const context: GridContext = { api: ctx.api, keydown$ };

    return html`
      <vuerd-grid-editor-provider .value=${context}>
        <div
          class="vuerd-grid-editor"
          @mousedown=${onOutside}
          @touchstart=${onOutside}
        >
          <div class="vuerd-grid-container"></div>
          <vuerd-filter
            .visible=${filterState.active}
            @close=${onCloseFilter}
          ></vuerd-filter>
        </div>
      </vuerd-grid-editor-provider>
    `;
  };
};

defineComponent('vuerd-grid-editor', {
  observedProps: [
    {
      name: 'width',
      default: 0,
    },
    {
      name: 'height',
      default: 0,
    },
  ],
  styleMap: {
    width: '100%',
    height: '100%',
  },
  style: IndexStyle,
  render: GridEditor,
});
