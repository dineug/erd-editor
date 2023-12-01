import { FC, html } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import MemoSash from '@/components/erd/canvas/memo/memo-sash/MemoSash';
import Icon from '@/components/primitives/icon/Icon';
import { moveAllAction$ } from '@/engine/modules/editor/generator.actions';
import { changeMemoValueAction } from '@/engine/modules/memo/atom.actions';
import {
  removeMemoAction$,
  selectMemoAction$,
} from '@/engine/modules/memo/generator.actions';
import { Memo } from '@/internal-types';
import { calcMemoHeight, calcMemoWidth } from '@/utils/calcMemo';
import { onStop } from '@/utils/domEvent';
import { openColorPickerAction } from '@/utils/emitter';
import { drag$, DragMove } from '@/utils/globalEventObservable';
import { focusEvent } from '@/utils/internalEvents';
import { isMod, simpleShortcutToString } from '@/utils/keyboard-shortcut';

import * as styles from './Memo.styles';

export type MemoProps = {
  memo: Memo;
};

const Memo: FC<MemoProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const handleMove = ({ event, movementX, movementY }: DragMove) => {
    event.type === 'mousemove' && event.preventDefault();
    const { store } = app.value;
    store.dispatch(moveAllAction$(movementX, movementY));
  };

  const handleMoveStart = (event: MouseEvent | TouchEvent) => {
    const el = event.target as HTMLElement | null;
    if (!el) return;

    const { store } = app.value;
    store.dispatch(selectMemoAction$(props.memo.id, isMod(event)));

    if (
      !el.closest('.memo-header-color') &&
      !el.closest('.memo-textarea') &&
      !el.closest('.icon') &&
      !el.closest('.sash')
    ) {
      drag$.subscribe(handleMove);
    }
  };

  const handleRemoveMemo = () => {
    const { store } = app.value;
    store.dispatch(removeMemoAction$(props.memo.id));
  };

  const handleInput = (event: InputEvent) => {
    const el = event.target as HTMLTextAreaElement | null;
    if (!el) return;

    const { store } = app.value;
    store.dispatch(
      changeMemoValueAction({
        id: props.memo.id,
        value: el.value,
      })
    );
  };

  const handleBlur = () => {
    ctx.host.dispatchEvent(focusEvent());
  };

  const handleOpenColorPicker = (event: MouseEvent) => {
    const { emitter } = app.value;
    emitter.emit(
      openColorPickerAction({
        x: event.clientX,
        y: event.clientY,
        color: props.memo.ui.color,
      })
    );
  };

  return () => {
    const { store, keyBindingMap } = app.value;
    const { editor } = store.state;
    const { memo } = props;
    const selected = Boolean(editor.selectedMap[memo.id]);
    const width = calcMemoWidth(memo);
    const height = calcMemoHeight(memo);

    return html`
      <div
        class=${['memo', styles.root]}
        style=${{
          top: `${memo.ui.y}px`,
          left: `${memo.ui.x}px`,
          'z-index': `${memo.ui.zIndex}`,
          width: `${width}px`,
          height: `${height}px`,
        }}
        ?data-selected=${selected}
        ?data-focus-border=${selected}
        @mousedown=${handleMoveStart}
        @touchstart=${handleMoveStart}
      >
        <div class=${styles.container}>
          <div class=${styles.header}>
            <div
              class=${['memo-header-color', styles.headerColor]}
              style=${{
                'background-color': memo.ui.color,
              }}
              @click=${handleOpenColorPicker}
            ></div>
            <div class=${styles.headerButtonWrap}>
              <${Icon}
                size=${12}
                name="xmark"
                title=${simpleShortcutToString(
                  keyBindingMap.removeTable[0]?.shortcut
                )}
                useTransition=${true}
                .onClick=${handleRemoveMemo}
              />
            </div>
          </div>
          <textarea
            class=${['memo-textarea', 'scrollbar', styles.textarea]}
            style=${{
              width: `${memo.ui.width}px`,
              height: `${memo.ui.height}px`,
            }}
            spellcheck="false"
            .value=${memo.value}
            @input=${handleInput}
            @wheel=${onStop}
            @blur=${handleBlur}
          ></textarea>
          <${MemoSash} memo=${memo} top=${height} left=${width} />
        </div>
      </div>
    `;
  };
};

export default Memo;
