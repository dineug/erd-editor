import { Memo } from '@@types/engine/store/memo.state';
import {
  defineComponent,
  html,
  FunctionalComponent,
} from '@dineug/lit-observable';
import { styleMap } from 'lit-html/directives/style-map';
import { SIZE_MEMO_PADDING } from '@/core/layout';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-minimap-memo': MinimapMemoElement;
  }
}

export interface MinimapMemoProps {
  memo: Memo;
}

export interface MinimapMemoElement extends MinimapMemoProps, HTMLElement {}

const MEMO_PADDING = SIZE_MEMO_PADDING * 2;
const MEMO_HEADER = 6 + MEMO_PADDING;

const MinimapMemo: FunctionalComponent<MinimapMemoProps, MinimapMemoElement> = (
  props,
  ctx
) => () => {
  const { memo } = props;
  const width = memo.ui.width + MEMO_PADDING;
  const height = memo.ui.height + MEMO_PADDING + MEMO_HEADER;

  return html`
    <div
      class="vuerd-memo"
      style=${styleMap({
        top: `${memo.ui.top}px`,
        left: `${memo.ui.left}px`,
        zIndex: `${memo.ui.zIndex}`,
        width: `${width}px`,
        height: `${height}px`,
      })}
    ></div>
  `;
};

defineComponent('vuerd-minimap-memo', {
  observedProps: ['memo'],
  shadow: false,
  render: MinimapMemo,
});
