import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { tryStartAltDragDuplicate } from '@/components/erd/canvas/altDragDuplicate';
import MemoSash from '@/components/erd/canvas/memo/memo-sash/MemoSash';
import { useSharedSelectEntity } from '@/components/erd/canvas/useSharedSelectEntity';
import Icon from '@/components/primitives/icon/Icon';
import { moveAllAction$ } from '@/engine/modules/editor/generator.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { changeMemoValueAction } from '@/engine/modules/memo/atom.actions';
import {
  removeMemoAction$,
  selectMemoAction$,
} from '@/engine/modules/memo/generator.actions';
import type { Memo } from '@/internal-types';
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
  const { sharedSelectColor } = useSharedSelectEntity(ctx, props.memo.id);

  const handleMove = ({ event, movementX, movementY }: DragMove) => {
    event.type === 'mousemove' && event.preventDefault();
    const { store } = app.value;
    store.dispatch(moveAllAction$(movementX, movementY));
  };

  const handleMoveStart = (event: MouseEvent | TouchEvent) => {
    const el = event.target as HTMLElement | null;
    if (!el) return;

    const { store } = app.value;
    const canDrag =
      !el.closest('.memo-header-color') &&
      !el.closest('.memo-textarea') &&
      !el.closest('.icon') &&
      !el.closest('.sash');

    // `move$` is not `share()`d and mutates module-global `prevX`/`prevY`, so
    // a second concurrent `drag$` subscriber always reads `movementX === 0`.
    if (
      canDrag &&
      tryStartAltDragDuplicate(app.value, event, props.memo.id, SelectType.memo)
    ) {
      return;
    }

    store.dispatch(selectMemoAction$(props.memo.id, isMod(event)));

    if (canDrag) {
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
    const sharedSelected = sharedSelectColor();
    const width = calcMemoWidth(memo);
    const height = calcMemoHeight(memo);

    return (
      <div
        class={['memo', styles.root]}
        style={{
          top: `${memo.ui.y}px`,
          left: `${memo.ui.x}px`,
          'z-index': `${memo.ui.zIndex}`,
          width: `${width}px`,
          height: `${height}px`,
          '--shared-select': sharedSelected ?? '',
        }}
        bool:data-selected={selected}
        bool:data-shared-select={Boolean(sharedSelected)}
        bool:data-focus-border={selected}
        on:mousedown={handleMoveStart}
        on:touchstart={handleMoveStart}
      >
        <div class={styles.container}>
          <div class={styles.header}>
            <div
              class={['memo-header-color', styles.headerColor]}
              style={{
                'background-color': memo.ui.color,
              }}
              on:click={handleOpenColorPicker}
            ></div>
            <div class={styles.headerButtonWrap}>
              <Icon
                size={12}
                name="x"
                title={simpleShortcutToString(
                  keyBindingMap.removeTable[0]?.shortcut
                )}
                useTransition={true}
                onClick={handleRemoveMemo}
              />
            </div>
          </div>
          <textarea
            class={['memo-textarea', 'scrollbar', styles.textarea]}
            style={{
              width: `${memo.ui.width}px`,
              height: `${memo.ui.height}px`,
            }}
            spellcheck="false"
            prop:value={memo.value}
            on:input={handleInput}
            on:wheel={onStop}
            on:blur={handleBlur}
          ></textarea>
          <MemoSash memo={memo} top={height} left={width} />
        </div>
      </div>
    );
  };
};

export default Memo;
