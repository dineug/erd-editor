/** @jsxHost konva */

import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { isEntityDragActive } from '@/components/erd/canvas/entityDrag';
import {
  RING_WIDTH,
  SCENE_FONT_FAMILY,
  SCENE_FONT_SIZE,
  TABLE_GROUP_FILL_OPACITY,
} from '@/components/erd/canvas/sceneTokens';
import { useSharedSelectEntity } from '@/components/erd/canvas/useSharedSelectEntity';
import { useI18n } from '@/components/localeContext';
import { useSceneSource } from '@/components/sceneSourceContext';
import { useThemeContext } from '@/components/themeContext';
import { TABLE_GROUP_TITLE_HEIGHT } from '@/constants/layout';
import type { TableGroup } from '@/internal-types';
import { getTableGroupColors, getTableGroupRect } from '@/utils/tableGroup';

/** The radius the group box is rounded with, a table's own. */
const TABLE_GROUP_CORNER_RADIUS = 6;

/** The width of the line around the box. */
const TABLE_GROUP_BORDER = 1;

/** The room the name keeps from each end of the title bar. */
const TITLE_PADDING = 8;

/** The weight the name is drawn at, a heading over the tables' own names. */
const TITLE_FONT_WEIGHT = 'bold';

export type TableGroupProps = {
  group: TableGroup;
};

/**
 * A group behind its tables, in getTableGroupRect's box: a title bar with the name over a body in
 * the group's color at a low alpha, one line around both, or the header's colors with no color it
 * reads. Title bar and body are separate nodes a press can tell apart, though neither listens yet.
 */
const TableGroup: FC<TableGroupProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);
  const i18n = useI18n(ctx);
  const sourceRef = useSceneSource(ctx);
  const { sharedSelectColor } = useSharedSelectEntity(ctx, props.group.id);

  return () => {
    const { store } = app.value;
    const { selectedMap } = store.state.editor;
    const { group } = props;
    const theme = themeRef.value;
    const selected = Boolean(selectedMap[group.id]);
    const sharedSelected = sharedSelectColor();

    // A member a drag holds is left out of the box, so the box neither
    // stretches after a table leaving it nor redraws on every step of the drag.
    // A group dragged itself moves with its members and keeps them all.
    const excludeTableIds =
      isEntityDragActive(store.state, sourceRef.value) && !selected
        ? Object.keys(selectedMap)
        : [];
    const { x, y, width, height } = getTableGroupRect(store.state, group, {
      excludeTableIds,
    });

    const colors = getTableGroupColors(group);
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
        listening={false}
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
        />
        <k-group name="table-group-title" kind="table-group-title">
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
            x={TITLE_PADDING}
            width={Math.max(width - TITLE_PADDING * 2, 0)}
            height={TABLE_GROUP_TITLE_HEIGHT}
            text={named ? group.name : i18n.value.t('common.unnamed')}
            fill={
              colors?.foreground ?? (named ? theme.active : theme.placeholder)
            }
            fontFamily={SCENE_FONT_FAMILY}
            fontSize={SCENE_FONT_SIZE}
            fontStyle={TITLE_FONT_WEIGHT}
            verticalAlign="middle"
            wrap="none"
            ellipsis={true}
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
        />
      </k-group>
    );
  };
};

export default TableGroup;
