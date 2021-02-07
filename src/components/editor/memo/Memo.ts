import {
  defineComponent,
  html,
  FunctionalComponent,
} from '@dineug/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { styleMap } from 'lit-html/directives/style-map';
import { SIZE_MEMO_PADDING } from '@/core/layout';
import { onStopPropagation } from '@/core/helper/dom.helper';
import { MemoStyle } from './Memo.style';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-memo': MemoElement;
  }
}

export interface MemoProps {}

export interface MemoElement extends MemoProps, HTMLElement {}

const MEMO_PADDING = SIZE_MEMO_PADDING * 2;
const MEMO_HEADER = 6 + MEMO_PADDING;

const Memo: FunctionalComponent<MemoProps, MemoElement> = (props, ctx) => {
  return () => {
    const width = 120;
    const height = 100;
    const left = width + MEMO_PADDING;
    const top = height + MEMO_PADDING + MEMO_HEADER;

    return html`
      <div
        class=${classMap({
          'vuerd-memo': true,
          active: true,
        })}
        style=${styleMap({
          top: `50px`,
          left: `50px`,
          zIndex: `1`,
        })}
        @mousedown=${onStopPropagation}
        @touchstart=${onStopPropagation}
      >
        <div class="vuerd-memo-header">
          <vuerd-icon class="vuerd-button" name="times" size="12"></vuerd-icon>
        </div>
        <textarea
          class="vuerd-memo-textarea vuerd-scrollbar"
          style=${styleMap({
            width: `${width}px`,
            height: `${height}px`,
          })}
          spellcheck="false"
        ></textarea>
        <vuerd-sash vertical></vuerd-sash>
        <vuerd-sash vertical .left=${left}></vuerd-sash>
        <vuerd-sash horizontal></vuerd-sash>
        <vuerd-sash horizontal .top=${top}></vuerd-sash>
        <vuerd-sash edge cursor="nwse-resize"></vuerd-sash>
        <vuerd-sash edge cursor="nesw-resize" .left=${left}></vuerd-sash>
        <vuerd-sash edge cursor="nesw-resize" .top=${top}></vuerd-sash>
        <vuerd-sash
          edge
          cursor="nwse-resize"
          .left=${left}
          .top=${top}
        ></vuerd-sash>
      </div>
    `;
  };
};

defineComponent('vuerd-memo', {
  style: MemoStyle,
  render: Memo,
});
