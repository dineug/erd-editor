import './Canvas';

import {
  defineComponent,
  html,
  FunctionalComponent,
} from '@dineug/lit-observable';
import { styleMap } from 'lit-html/directives/style-map';
import { getVuerdContextRef } from '@/components/ERDEditorProvider';
import { movementCanvas } from '@/engine/command/canvas.command.helper';
import { ERDStyle } from './ERD.style';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-erd': ERDElement;
  }
}

export interface ERDProps {
  width: number;
  height: number;
}

export interface ERDElement extends ERDProps, HTMLElement {}

const ERD: FunctionalComponent<ERDProps, ERDElement> = (props, ctx) => {
  const contextRef = getVuerdContextRef(ctx);

  const onMousedown = () => {
    const { drag$ } = contextRef.value.globalEvent;
    const { store } = contextRef.value;
    drag$.subscribe(move => {
      move.event.type === 'mousemove' && move.event.preventDefault();
      store.dispatch(movementCanvas(move.movementX, move.movementY));
    });
  };

  return () => html`
    <div
      class="vuerd-erd"
      style=${styleMap({
        width: `${props.width}px`,
        height: `${props.height}px`,
      })}
      @mousedown=${onMousedown}
    >
      <vuerd-canvas></vuerd-canvas>
    </div>
  `;
};

defineComponent('vuerd-erd', {
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
    height: '100%',
  },
  style: ERDStyle,
  render: ERD,
});
