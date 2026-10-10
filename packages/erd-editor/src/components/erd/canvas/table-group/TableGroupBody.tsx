/** @jsxHost konva */

import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import {
  type SceneMouseEvent,
  type ScenePointerEvent,
  TABLE_GROUP_CORNER_RADIUS,
  TABLE_GROUP_FILL_OPACITY,
} from '@/components/erd/canvas/sceneTokens';
import {
  getDrawnTableGroupRect,
  type TableGroupLinks,
} from '@/components/erd/canvas/table-group/tableGroupBox';
import { useSceneSource } from '@/components/sceneSourceContext';
import { useThemeContext } from '@/components/themeContext';
import { TABLE_GROUP_TITLE_HEIGHT } from '@/constants/layout';
import { selectTableGroupAction$ } from '@/engine/modules/table-group/generator.actions';
import type { Table, TableGroup } from '@/internal-types';
import { isMainButtonPress, isMultiTouch } from '@/utils/domEvent';
import { getTableGroupColors } from '@/utils/tableGroup';

export type TableGroupBodyProps = {
  group: TableGroup;
  /** The group's member tables, read once for every group by TableGroups. */
  members: ReadonlyArray<Table>;
  links: TableGroupLinks;
};

/**
 * A group's body under its bar, in its color at a low alpha or the theme's group body (alpha its own),
 * drawn before every frame, so no body stands over another group's bar. The main button reads it as
 * the canvas under it, so only another button selects the group there, for the menu it opens.
 */
const TableGroupBody: FC<TableGroupBodyProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);
  const sourceRef = useSceneSource(ctx);

  const handleBodyPress = (event: ScenePointerEvent) => {
    const { group, links } = props;
    links.guardOf(group.id).track('body', event as SceneMouseEvent);
    if (isMainButtonPress(event.evt) || isMultiTouch(event.evt)) return;

    const { store } = app.value;
    store.dispatch(
      selectTableGroupAction$(
        group.id,
        Boolean(store.state.editor.selectedMap[group.id])
      )
    );
  };

  return () => {
    const { store } = app.value;
    const { group, members, links } = props;
    const { x, y, width, height } =
      links.draftOf(group.id) ??
      getDrawnTableGroupRect(store.state, group, sourceRef.value, members);
    const colors = getTableGroupColors(group);

    return (
      <k-rect
        id={`table-group-body-${group.id}`}
        name="table-group-body"
        kind="table-group-body"
        x={x}
        y={y + TABLE_GROUP_TITLE_HEIGHT}
        width={width}
        height={Math.max(height - TABLE_GROUP_TITLE_HEIGHT, 0)}
        cornerRadius={[
          0,
          0,
          TABLE_GROUP_CORNER_RADIUS,
          TABLE_GROUP_CORNER_RADIUS,
        ]}
        fill={colors?.background ?? themeRef.value.tableGroupBackground}
        opacity={colors ? TABLE_GROUP_FILL_OPACITY : 1}
        on:mousedown={handleBodyPress}
      />
    );
  };
};

export default TableGroupBody;
