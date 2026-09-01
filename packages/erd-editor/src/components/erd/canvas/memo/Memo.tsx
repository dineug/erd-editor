/** @jsxHost konva */

import { FC, observable } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import MemoSash from '@/components/erd/canvas/memo/memo-sash/MemoSash';
import {
  layoutMemoLines,
  MEMO_FONT_WEIGHT,
  MEMO_LINE_HEIGHT,
} from '@/components/erd/canvas/memo/memoText';
import { useMoveMemo } from '@/components/erd/canvas/memo/useMoveMemo';
import { sceneIcon } from '@/components/erd/canvas/SceneIcon.template';
import {
  CURSOR_INHERIT,
  CURSOR_POINTER,
  CURSOR_TEXT,
  HIT_FILL,
  RING_WIDTH,
  SCENE_FONT_FAMILY,
  SCENE_FONT_SIZE,
  type SceneMouseEvent,
  setSceneCursor,
  TRANSPARENT,
} from '@/components/erd/canvas/sceneTokens';
import { useSharedSelectEntity } from '@/components/erd/canvas/useSharedSelectEntity';
import { useThemeContext } from '@/components/themeContext';
import {
  HEADER_ICON_HEIGHT,
  MEMO_BORDER,
  MEMO_HEADER_HEIGHT,
  MEMO_PADDING,
} from '@/constants/layout';
import { editMemoAction } from '@/engine/modules/editor/atom.actions';
import { removeMemoAction$ } from '@/engine/modules/memo/generator.actions';
import type { Memo } from '@/internal-types';
import { getMemoRect } from '@/konva/scene/metrics';
import { openColorPickerAction } from '@/utils/emitter';

/** The radius the memo box is rounded with. */
const MEMO_CORNER_RADIUS = 6;

/** The height of the colour bar across the memo header. */
const MEMO_HEADER_COLOR_HEIGHT = 4;

export type MemoProps = {
  memo: Memo;
  /** A drawn copy rather than the memo itself, so nothing in it takes an id. */
  preview?: boolean;
};

const Memo: FC<MemoProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);
  const { sharedSelectColor } = useSharedSelectEntity(ctx, props.memo.id);
  const { onMoveStart } = useMoveMemo(ctx, props);
  const state = observable({ hover: false, removeHover: false });

  const handleMouseenter = () => {
    state.hover = true;
  };

  const handleMouseleave = () => {
    state.hover = false;
  };

  const handleRemoveMouseenter = (event: SceneMouseEvent) => {
    state.removeHover = true;
    setSceneCursor(event, CURSOR_POINTER);
  };

  const handleRemoveMouseleave = (event: SceneMouseEvent) => {
    state.removeHover = false;
    setSceneCursor(event, CURSOR_INHERIT);
  };

  const handleRemoveMemo = () => {
    const { store } = app.value;
    store.dispatch(removeMemoAction$(props.memo.id));
  };

  const handleOpenColorPicker = (event: SceneMouseEvent) => {
    const { emitter } = app.value;
    emitter.emit(
      openColorPickerAction({
        x: event.evt.clientX,
        y: event.evt.clientY,
        color: props.memo.ui.color,
      })
    );
  };

  const handleEditValue = () => {
    if (props.preview) return;

    const { store } = app.value;
    store.dispatch(editMemoAction({ id: props.memo.id }));
  };

  const handleValueMouseenter = (event: SceneMouseEvent) => {
    setSceneCursor(event, props.preview ? CURSOR_INHERIT : CURSOR_TEXT);
  };

  const handleValueMouseleave = (event: SceneMouseEvent) => {
    setSceneCursor(event, CURSOR_INHERIT);
  };

  return () => {
    const { store } = app.value;
    const { editor } = store.state;
    const { memo } = props;
    const theme = themeRef.value;
    const selected = Boolean(editor.selectedMap[memo.id]);
    const sharedSelected = sharedSelectColor();
    const editing = !props.preview && editor.editMemoId === memo.id;
    const value = layoutMemoLines(memo.value, memo.ui.width).join('\n');
    const { width, height } = getMemoRect(memo);
    // A CSS border sits inside the box and a konva stroke straddles the path,
    // so both edges only cover the same pixels from half a width in.
    const bodyInset = MEMO_BORDER / 2;
    const ringInset = RING_WIDTH / 2;

    return (
      <k-group
        id={props.preview ? '' : `memo-${memo.id}`}
        name="memo"
        kind="memo"
        selected={selected}
        sharedSelect={sharedSelected}
        x={memo.ui.x}
        y={memo.ui.y}
        on:mousedown={onMoveStart}
        on:touchstart={onMoveStart}
        on:mouseenter={handleMouseenter}
        on:mouseleave={handleMouseleave}
      >
        <k-rect
          name="memo-shared-select"
          kind="memo-shared-select"
          x={-ringInset}
          y={-ringInset}
          width={width + RING_WIDTH}
          height={height + RING_WIDTH}
          cornerRadius={MEMO_CORNER_RADIUS + RING_WIDTH}
          stroke={sharedSelected ?? ''}
          strokeWidth={RING_WIDTH}
          listening={false}
        />
        <k-rect
          name="memo-body"
          kind="memo-body"
          x={bodyInset}
          y={bodyInset}
          width={width - MEMO_BORDER}
          height={height - MEMO_BORDER}
          cornerRadius={MEMO_CORNER_RADIUS}
          fill={theme.memoBackground}
          stroke={selected ? theme.memoSelect : theme.memoBorder}
          strokeWidth={MEMO_BORDER}
        />
        <k-group
          name="memo-container"
          kind="memo-container"
          x={MEMO_BORDER}
          y={MEMO_BORDER}
        >
          <k-rect
            name="memo-header-color"
            kind="memo-header-color"
            x={0}
            y={-MEMO_BORDER}
            width={width - MEMO_BORDER * 2}
            height={MEMO_HEADER_COLOR_HEIGHT}
            cornerRadius={[MEMO_CORNER_RADIUS, MEMO_CORNER_RADIUS, 0, 0]}
            fill={memo.ui.color}
            on:click={handleOpenColorPicker}
            on:mouseenter={(event: SceneMouseEvent) => {
              setSceneCursor(event, CURSOR_POINTER);
            }}
            on:mouseleave={(event: SceneMouseEvent) => {
              setSceneCursor(event, CURSOR_INHERIT);
            }}
          />
          {sceneIcon({
            icon: 'x',
            name: 'memo-remove',
            kind: 'icon',
            size: HEADER_ICON_HEIGHT,
            color: state.hover
              ? state.removeHover
                ? theme.active
                : theme.foreground
              : TRANSPARENT,
            x: MEMO_PADDING + memo.ui.width - HEADER_ICON_HEIGHT,
            y: MEMO_PADDING,
            click: handleRemoveMemo,
            mouseenter: handleRemoveMouseenter,
            mouseleave: handleRemoveMouseleave,
          })}
          <k-group
            name="memo-text-clip"
            kind="memo-textarea"
            x={MEMO_PADDING}
            y={MEMO_PADDING + MEMO_HEADER_HEIGHT}
            clipX={0}
            clipY={0}
            clipWidth={memo.ui.width}
            clipHeight={memo.ui.height}
            on:click={handleEditValue}
            on:mouseenter={handleValueMouseenter}
            on:mouseleave={handleValueMouseleave}
          >
            <k-rect
              name="memo-textarea-hit"
              kind="memo-textarea"
              x={0}
              y={0}
              width={memo.ui.width}
              height={memo.ui.height}
              fill={HIT_FILL}
            />
            <k-text
              name="memo-textarea"
              kind="memo-textarea"
              text={value}
              visible={!editing}
              fill={theme.active}
              fontFamily={SCENE_FONT_FAMILY}
              fontSize={SCENE_FONT_SIZE}
              fontStyle={MEMO_FONT_WEIGHT}
              lineHeight={MEMO_LINE_HEIGHT}
              wrap="none"
            />
          </k-group>
          <MemoSash memo={memo} top={height} left={width} />
        </k-group>
      </k-group>
    );
  };
};

export default Memo;
