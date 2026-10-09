/** @jsxHost konva */

import { FC, observable } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { isEntityDragActive } from '@/components/erd/canvas/entityDrag';
import {
  mainButtonClick,
  RING_WIDTH,
  SCENE_FONT_FAMILY,
  SCENE_FONT_SIZE,
  type SceneMouseEvent,
  type ScenePointerEvent,
  TABLE_GROUP_CORNER_RADIUS,
  TABLE_GROUP_FILL_OPACITY,
  TABLE_GROUP_TITLE_FONT_WEIGHT,
  TABLE_GROUP_TITLE_PADDING,
} from '@/components/erd/canvas/sceneTokens';
import { createDoubleClickGuard } from '@/components/erd/canvas/table/doubleClick';
import TableGroupSash from '@/components/erd/canvas/table-group/TableGroupSash';
import { getTableGroupNameBox } from '@/components/erd/canvas/table-group/titleLayout';
import { useMoveEntity } from '@/components/erd/canvas/useMoveEntity';
import { useSharedSelectEntity } from '@/components/erd/canvas/useSharedSelectEntity';
import { openTableGroupNameEditor } from '@/components/erd/table-group/tableGroupName';
import { useI18n } from '@/components/localeContext';
import { useSceneSource } from '@/components/sceneSourceContext';
import { useThemeContext } from '@/components/themeContext';
import { TABLE_GROUP_TITLE_HEIGHT } from '@/constants/layout';
import { SelectType } from '@/engine/modules/editor/state';
import { selectTableGroupAction$ } from '@/engine/modules/table-group/generator.actions';
import type { TableGroup } from '@/internal-types';
import type { Rect } from '@/konva/scene/metrics';
import { isMainButtonPress, isMultiTouch } from '@/utils/domEvent';
import { getTableGroupColors, getTableGroupRect } from '@/utils/tableGroup';

/** The width of the line around the box. */
const TABLE_GROUP_BORDER = 1;

/** The title bar's press is a click as well, so its drag waits for the pointer to travel. */
const TITLE_KINDS = ['table-group-title'];

export type TableGroupProps = {
  group: TableGroup;
};

/**
 * A group behind its tables, in getTableGroupRect's box: a title bar with the name over a body in
 * the group's color at a low alpha, one line around both, or the header's colors with no color it
 * reads. The bar selects and carries the group, the body is canvas to the main button.
 */
const TableGroup: FC<TableGroupProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);
  const i18n = useI18n(ctx);
  const sourceRef = useSceneSource(ctx);
  const { sharedSelectColor } = useSharedSelectEntity(ctx, props.group.id);
  // The box a sash drag draws until it writes its one resize.
  const draft = observable({ rect: null as Rect | null });

  const { onMoveStart } = useMoveEntity(ctx, {
    entityId: () => props.group.id,
    selectType: SelectType.tableGroup,
    blockedKinds: () => [],
    clickKinds: () => TITLE_KINDS,
    canMove: () => !app.value.store.getReadonly(),
    source: sourceRef,
  });

  // Konva makes a double click of any pair inside its window, wherever its
  // first press was, so the bar opens its name editor only on a pair begun there.
  const doubleClick = createDoubleClickGuard();

  const handleTitlePress = (event: ScenePointerEvent) => {
    doubleClick.track('title', event as SceneMouseEvent);
    onMoveStart(event);
  };

  const handleTitleDoubleClick = (event: SceneMouseEvent) => {
    if (!doubleClick.isDouble('title', event)) return;
    openTableGroupNameEditor(app.value.store, props.group.id);
  };

  // The main button reads the body as the canvas under it, so only another
  // button selects the group there, for the menu it opens.
  const handleBodyPress = (event: ScenePointerEvent) => {
    doubleClick.track('body', event as SceneMouseEvent);
    if (isMainButtonPress(event.evt) || isMultiTouch(event.evt)) return;

    const { store } = app.value;
    const { id } = props.group;
    store.dispatch(
      selectTableGroupAction$(id, Boolean(store.state.editor.selectedMap[id]))
    );
  };

  const handleDraft = (rect: Rect | null) => {
    draft.rect = rect;
  };

  return () => {
    const { store } = app.value;
    const { selectedMap } = store.state.editor;
    const { group } = props;
    const theme = themeRef.value;
    const selected = Boolean(selectedMap[group.id]);
    const sharedSelected = sharedSelectColor();
    // The name editor stands over the bar in its place.
    const editing = store.state.editor.editTableGroupId === group.id;

    // A member a drag holds is left out of the box, so the box neither
    // stretches after a table leaving it nor redraws on every step of the drag.
    // A group dragged itself moves with its members and keeps them all.
    const excludeTableIds =
      isEntityDragActive(store.state, sourceRef.value) && !selected
        ? Object.keys(selectedMap)
        : [];
    const box =
      draft.rect ??
      getTableGroupRect(store.state, group, {
        excludeTableIds,
      });
    const { x, y, width, height } = box;

    const colors = getTableGroupColors(group);
    const nameBox = getTableGroupNameBox();
    const named = Boolean(group.name.trim());
    const borderInset = TABLE_GROUP_BORDER / 2;
    const ringInset = RING_WIDTH / 2;

    return (
      <k-group
        id={`table-group-${group.id}`}
        name="table-group"
        kind="table-group"
        selected={selected}
        sharedSelect={sharedSelected}
        x={x}
        y={y}
      >
        <k-rect
          name="table-group-body"
          kind="table-group-body"
          y={TABLE_GROUP_TITLE_HEIGHT}
          width={width}
          height={Math.max(height - TABLE_GROUP_TITLE_HEIGHT, 0)}
          cornerRadius={[
            0,
            0,
            TABLE_GROUP_CORNER_RADIUS,
            TABLE_GROUP_CORNER_RADIUS,
          ]}
          fill={colors?.background ?? theme.foreground}
          opacity={TABLE_GROUP_FILL_OPACITY}
          on:mousedown={handleBodyPress}
        />
        <k-group
          name="table-group-title"
          kind="table-group-title"
          on:mousedown={handleTitlePress}
          on:touchstart={onMoveStart}
          on:dblclick={mainButtonClick(handleTitleDoubleClick)}
        >
          <k-rect
            name="table-group-title-bar"
            width={width}
            height={TABLE_GROUP_TITLE_HEIGHT}
            cornerRadius={[
              TABLE_GROUP_CORNER_RADIUS,
              TABLE_GROUP_CORNER_RADIUS,
              0,
              0,
            ]}
            fill={colors?.background ?? theme.tableHeaderBackground}
          />
          <k-text
            name="table-group-name"
            x={TABLE_GROUP_TITLE_PADDING}
            y={nameBox.y}
            width={Math.max(width - TABLE_GROUP_TITLE_PADDING * 2, 0)}
            height={nameBox.height}
            text={named ? group.name : i18n.value.t('common.unnamed')}
            fill={
              colors?.foreground ?? (named ? theme.active : theme.placeholder)
            }
            fontFamily={SCENE_FONT_FAMILY}
            fontSize={SCENE_FONT_SIZE}
            fontStyle={TABLE_GROUP_TITLE_FONT_WEIGHT}
            verticalAlign="middle"
            wrap="none"
            ellipsis={true}
            visible={!editing}
            listening={false}
          />
        </k-group>
        <k-rect
          name="table-group-border"
          x={borderInset}
          y={borderInset}
          width={width - TABLE_GROUP_BORDER}
          height={height - TABLE_GROUP_BORDER}
          cornerRadius={TABLE_GROUP_CORNER_RADIUS}
          stroke={
            selected
              ? theme.memoSelect
              : (colors?.background ?? theme.tableBorder)
          }
          strokeWidth={TABLE_GROUP_BORDER}
          listening={false}
        />
        <k-rect
          name="table-group-shared-select"
          x={-ringInset}
          y={-ringInset}
          width={width + RING_WIDTH}
          height={height + RING_WIDTH}
          cornerRadius={TABLE_GROUP_CORNER_RADIUS + RING_WIDTH}
          stroke={sharedSelected ?? ''}
          strokeWidth={RING_WIDTH}
          listening={false}
        />
        {selected && !store.getReadonly() ? (
          <TableGroupSash group={group} box={box} onDraft={handleDraft} />
        ) : null}
      </k-group>
    );
  };
};

export default TableGroup;
