import { ERDEditorContext } from '@@types/index';
import {
  defineComponent,
  html,
  FunctionalComponent,
  query,
  mounted,
  beforeMount,
} from '@dineug/lit-observable';
import tuiGrid from 'tui-grid';
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

export interface GridElement extends GridProps, HTMLElement {
  api: ERDEditorContext;
}

const Grid: FunctionalComponent<GridProps, GridElement> = (props, ctx) => {
  const containerRef = query<HTMLElement>('.vuerd-grid');

  beforeMount(() => {
    console.log(ctx.api);
  });

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

  return () => html`<div class="vuerd-grid"></div>`;
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
