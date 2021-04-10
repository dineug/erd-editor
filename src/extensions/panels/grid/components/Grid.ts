import './GridProvider';
import './filter/Filter';

import { ERDEditorContext } from '@@types/index';
import {
  defineComponent,
  html,
  FunctionalComponent,
  query,
  mounted,
} from '@dineug/lit-observable';
import tuiGrid from 'tui-grid';
import { useGridKeymap } from '@/extensions/panels/grid/hooks/gridKeymap.hook';
import { useKeydown } from '@/extensions/panels/grid/hooks/keydown.hook';
import { GridContext } from '@/extensions/panels/grid/GridContext';
import { IndexStyle } from './index.style';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-grid': GridElement;
  }
}

export interface GridProps {
  width: number;
  height: number;
}

// GridProvider

export interface GridElement extends GridProps, HTMLElement {
  api: ERDEditorContext;
}

const Grid: FunctionalComponent<GridProps, GridElement> = (props, ctx) => {
  const containerRef = query<HTMLElement>('.vuerd-grid-container');
  const { keydown$ } = useKeydown(ctx);
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

  mounted(() => {
    new tuiGrid({
      el: containerRef.value,
      usageStatistics: false,
      bodyHeight: props.height,
      columnOptions: {
        frozenCount: 1,
        frozenBorderWidth: 0,
        minWidth: 300,
      },
      columns: [],
      data: [],
    });
  });

  return () => {
    const {
      store: {
        editorState: { filterState },
      },
    } = ctx.api;
    const context: GridContext = { api: ctx.api, keydown$ };

    return html`
      <vuerd-grid-provider .value=${context}>
        <div
          class="vuerd-grid"
          @mousedown=${onOutside}
          @touchstart=${onOutside}
        >
          <div class="vuerd-grid-container"></div>
          <vuerd-filter
            .visible=${filterState.active}
            @close=${onCloseFilter}
          ></vuerd-filter>
        </div>
      </vuerd-grid-provider>
    `;
  };
};

defineComponent('vuerd-grid', {
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
  render: Grid,
});
