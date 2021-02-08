import {
  defineComponent,
  html,
  FunctionalComponent,
} from '@dineug/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { styleMap } from 'lit-html/directives/style-map';
import { SIZE_SASH } from '@/core/layout';
import { useContext } from '@/core/hooks/context.hook';
import { SashStyle } from './Sash.style';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-sash': SashElement;
  }
}

export type Cursor =
  | 'default'
  | 'nwse-resize'
  | 'nesw-resize'
  | 'ew-resize'
  | 'ns-resize'
  | 'col-resize'
  | 'row-resize';

export interface SashProps {
  vertical: boolean;
  horizontal: boolean;
  edge: boolean;
  cursor: Cursor;
  top: number;
  left: number;
}

export interface SashElement extends SashProps, HTMLElement {}

const classKeys = ['vertical', 'horizontal', 'edge'];

const Sash: FunctionalComponent<SashProps, SashElement> = (props, ctx) => {
  const contextRef = useContext(ctx);

  const centerTop = () =>
    props.top === 0 && !props.horizontal && !props.edge
      ? props.top
      : props.top - SIZE_SASH / 2;

  const centerLeft = () =>
    props.left === 0 && !props.vertical && !props.edge
      ? props.left
      : props.left - SIZE_SASH / 2;

  const getClassMap = () =>
    Object.assign(
      { 'vuerd-sash': true },
      classKeys.reduce((map: any, key) => {
        map[key] = (props as any)[key];
        return map;
      }, {})
    );

  const getStyleMap = () => ({
    top: `${centerTop()}px`,
    left: `${centerLeft()}px`,
    cursor: props.edge ? props.cursor : '',
  });

  const onMousedown = () => {
    const { drag$ } = contextRef.value.globalEvent;
    drag$.subscribe(move => {
      move.event.type === 'mousemove' && move.event.preventDefault();
      ctx.dispatchEvent(
        new CustomEvent('global-move', {
          detail: {
            movementX: move.movementX,
            movementY: move.movementY,
            x: move.x,
            y: move.y,
          },
        })
      );
    });
  };

  return () =>
    html`
      <div
        class=${classMap(getClassMap())}
        style=${styleMap(getStyleMap())}
        @mousedown=${onMousedown}
      ></div>
    `;
};

defineComponent('vuerd-sash', {
  observedProps: [
    {
      name: 'vertical',
      type: Boolean,
      default: false,
    },
    {
      name: 'horizontal',
      type: Boolean,
      default: false,
    },
    {
      name: 'edge',
      type: Boolean,
      default: false,
    },
    {
      name: 'cursor',
      default: 'default',
    },
    {
      name: 'top',
      type: Number,
      default: 0,
    },
    {
      name: 'left',
      type: Number,
      default: 0,
    },
  ],
  style: SashStyle,
  render: Sash,
});
