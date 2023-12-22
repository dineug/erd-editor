import {
  defineComponent,
  FunctionalComponent,
  html,
} from '@vuerd/lit-observable';

import { useColumnHint } from '@/core/hooks/columnHint.hook';
import { useContext } from '@/core/hooks/context.hook';
import { useFlipAnimation } from '@/core/hooks/flipAnimation.hook';
import { Table } from '@@types/engine/store/table.state';

import { hintTpl } from './IndexAddColumn.template';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-index-add-column': IndexAddColumnElement;
  }
}

export interface IndexAddColumnProps {
  table: Table;
  indexId: string;
}

export interface IndexAddColumnElement
  extends IndexAddColumnProps,
    HTMLElement {}

const IndexAddColumn: FunctionalComponent<
  IndexAddColumnProps,
  IndexAddColumnElement
> = (props, ctx) => {
  const contextRef = useContext(ctx);
  const { hintState, onSelectHint, onKeydown, onInput } = useColumnHint(
    props,
    ctx
  );
  useFlipAnimation(
    ctx,
    '.vuerd-index-add-column-hint',
    'vuerd-index-add-column-hint-move'
  );

  const onFocus = () => {
    hintState.focus = true;
  };

  const onBlur = () => {
    hintState.focus = false;

    setTimeout(() => {
      if (hintState.focus) return;
      hintState.hints = [];
    }, 200);
  };

  return () => {
    const {
      store: {
        editorState: { readonly },
      },
    } = contextRef.value;

    return html`
      <div class="vuerd-index-add-column">
        <input
          style="width: 80px;"
          type="text"
          placeholder="add column"
          spellcheck="false"
          ?disabled=${readonly}
          .value=${hintState.value}
          @keydown=${onKeydown}
          @input=${onInput}
          @focus=${onFocus}
          @blur=${onBlur}
        />
        ${hintTpl({ onSelectHint }, hintState)}
      </div>
    `;
  };
};

defineComponent('vuerd-index-add-column', {
  observedProps: ['table', 'indexId'],
  shadow: false,
  render: IndexAddColumn,
});
