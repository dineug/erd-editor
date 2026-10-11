/** @jsxHost konva */

import { FC, observable, onUnmounted } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { sceneIcon } from '@/components/erd/canvas/SceneIcon.template';
import {
  CURSOR_INHERIT,
  CURSOR_POINTER,
  mainButtonClick,
  RING_WIDTH,
  SCENE_FONT_FAMILY,
  SCENE_FONT_SIZE,
  type SceneMouseEvent,
  type ScenePointerEvent,
  setSceneCursor,
  TABLE_GROUP_CORNER_RADIUS,
  TABLE_GROUP_TITLE_FONT_WEIGHT,
  TRANSPARENT,
} from '@/components/erd/canvas/sceneTokens';
import {
  getDrawnTableGroupRect,
  type TableGroupLinks,
} from '@/components/erd/canvas/table-group/tableGroupBox';
import TableGroupSash from '@/components/erd/canvas/table-group/TableGroupSash';
import {
  getTableGroupIconBox,
  getTableGroupNameBox,
  getTableGroupRemoveBox,
} from '@/components/erd/canvas/table-group/titleLayout';
import { useMoveEntity } from '@/components/erd/canvas/useMoveEntity';
import { useSharedSelectEntity } from '@/components/erd/canvas/useSharedSelectEntity';
import { openTableGroupNameEditor } from '@/components/erd/table-group/tableGroupName';
import { useI18n } from '@/components/localeContext';
import { useSceneSource } from '@/components/sceneSourceContext';
import { useThemeContext } from '@/components/themeContext';
import { TABLE_GROUP_TITLE_HEIGHT } from '@/constants/layout';
import { SelectType } from '@/engine/modules/editor/state';
import { removeTableGroupAction$ } from '@/engine/modules/table-group/generator.actions';
import type { Table, TableGroup } from '@/internal-types';
import type { Rect } from '@/konva/scene/metrics';
import type { Theme } from '@/themes/tokens';
import { getTableGroupColors, type TableGroupColors } from '@/utils/tableGroup';

/** The width of the line around the box. */
const TABLE_GROUP_BORDER = 1;

/** The title bar's press is a click as well, so its drag waits for the pointer to travel. */
const TITLE_KINDS = ['table-group-title'];

/** The remove button is a button, so a press on it carries nothing. */
const BLOCKED_KINDS = ['icon'];

export type TableGroupProps = {
  group: TableGroup;
  /** The group's member tables, read once for every group by TableGroups. */
  members: ReadonlyArray<Table>;
  links: TableGroupLinks;
};

/**
 * A group's frame over its body (TableGroupBody), in getDrawnTableGroupRect's box: a title bar with
 * the group icon, the name and the remove button, one line around the box, the peer ring and the
 * sashes, in the theme's group colors with no color it reads.
 */
const TableGroup: FC<TableGroupProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);
  const i18n = useI18n(ctx);
  const sourceRef = useSceneSource(ctx);
  const { sharedSelectColor } = useSharedSelectEntity(ctx, props.group.id);
  const state = observable({ removeHover: false });

  const { onMoveStart } = useMoveEntity(ctx, {
    entityId: () => props.group.id,
    selectType: SelectType.tableGroup,
    blockedKinds: () => BLOCKED_KINDS,
    clickKinds: () => TITLE_KINDS,
    canMove: () => !app.value.store.getReadonly(),
    source: sourceRef,
  });

  // Konva makes a double click of any pair inside its window, wherever its
  // first press was, so the bar opens its name editor only on a pair begun there.
  const guard = () => props.links.guardOf(props.group.id);

  const handleTitlePress = (event: ScenePointerEvent) => {
    guard().track('title', event as SceneMouseEvent);
    onMoveStart(event);
  };

  const handleTitleDoubleClick = (event: SceneMouseEvent) => {
    if (!guard().isDouble('title', event)) return;
    openTableGroupNameEditor(app.value.store, props.group.id);
  };

  const handleDraft = (rect: Rect | null) => {
    props.links.setDraft(props.group.id, rect);
  };

  // The frame and the body together are the group a hover shows the button over, as a table's card is.
  const handleMouseenter = () => {
    props.links.setHover(props.group.id, 'frame', true);
  };

  const handleMouseleave = () => {
    props.links.setHover(props.group.id, 'frame', false);
  };

  // A removed group takes its node from under the pointer, which sends no leave.
  onUnmounted(handleMouseleave);

  const handleRemoveMouseenter = (event: SceneMouseEvent) => {
    state.removeHover = true;
    setSceneCursor(event, CURSOR_POINTER);
  };

  const handleRemoveMouseleave = (event: SceneMouseEvent) => {
    state.removeHover = false;
    setSceneCursor(event, CURSOR_INHERIT);
  };

  // The button takes the group alone and keeps its tables, as the menu's Delete does.
  const handleRemove = () => {
    app.value.store.dispatch(removeTableGroupAction$(props.group.id));
  };

  /** The button's color: none at rest, and on a group's color the text drawn over it. */
  const removeColor = (theme: Theme, colors: TableGroupColors | null) => {
    if (!props.links.isHovered(props.group.id)) return TRANSPARENT;
    if (colors) return colors.foreground;

    return state.removeHover ? theme.active : theme.foreground;
  };

  return () => {
    const { store } = app.value;
    const { selectedMap } = store.state.editor;
    const { group, members, links } = props;
    const theme = themeRef.value;
    const selected = Boolean(selectedMap[group.id]);
    const sharedSelected = sharedSelectColor();
    // The name editor stands over the bar in its place.
    const editing = store.state.editor.editTableGroupId === group.id;

    const box =
      links.draftOf(group.id) ??
      getDrawnTableGroupRect(store.state, group, sourceRef.value, members);
    const { x, y, width, height } = box;

    const colors = getTableGroupColors(group);
    const nameBox = getTableGroupNameBox(width);
    const iconBox = getTableGroupIconBox();
    const removeBox = getTableGroupRemoveBox(width);
    const readonly = store.getReadonly();
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
        on:mouseenter={handleMouseenter}
        on:mouseleave={handleMouseleave}
      >
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
            fill={colors?.background ?? theme.tableGroupHeaderBackground}
          />
          <k-group name="table-group-icon-holder" listening={false}>
            {sceneIcon({
              icon: 'group',
              name: 'table-group-icon',
              kind: 'table-group-icon',
              size: iconBox.size,
              color: colors?.foreground ?? theme.active,
              x: iconBox.x,
              y: iconBox.y,
            })}
          </k-group>
          <k-text
            name="table-group-name"
            x={nameBox.x}
            y={nameBox.y}
            width={nameBox.width}
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
          {readonly
            ? null
            : sceneIcon({
                icon: 'x',
                name: 'table-group-remove',
                kind: 'icon',
                size: removeBox.size,
                color: removeColor(theme, colors),
                mouseenter: handleRemoveMouseenter,
                mouseleave: handleRemoveMouseleave,
                x: removeBox.x,
                y: removeBox.y,
                click: handleRemove,
              })}
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
              : (colors?.background ?? theme.tableGroupBorder)
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
        {readonly ? null : (
          <TableGroupSash group={group} box={box} onDraft={handleDraft} />
        )}
      </k-group>
    );
  };
};

export default TableGroup;
