/** @jsxHost konva */

import { query } from '@dineug/erd-editor-schema';
import { FC, repeat } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import TableGroup from '@/components/erd/canvas/table-group/TableGroup';
import TableGroupBody from '@/components/erd/canvas/table-group/TableGroupBody';
import {
  createTableGroupLinks,
  createTableGroupMemberLists,
} from '@/components/erd/canvas/table-group/tableGroupBox';

export type TableGroupsProps = {};

/**
 * The document's groups by zIndex in two passes, every body before every frame, so a group's bar
 * and sashes stand over every body: a large group drawn over a smaller one it holds leaves the
 * inner bar to its own group. A scene mounts it while groups show; it reads the list itself.
 */
const TableGroups: FC<TableGroupsProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const links = createTableGroupLinks();
  const memberLists = createTableGroupMemberLists();

  return () => {
    const { state } = app.value.store;
    const groups = query(state.collections)
      .collection('tableGroupEntities')
      .selectByIds(state.doc.tableGroupIds)
      .sort((a, b) => a.ui.zIndex - b.ui.zIndex);
    const membersOf = memberLists(state);

    return (
      <>
        {repeat(
          groups,
          group => group.id,
          group => (
            <TableGroupBody
              group={group}
              members={membersOf(group.id)}
              links={links}
            />
          )
        )}
        {repeat(
          groups,
          group => group.id,
          group => (
            <TableGroup
              group={group}
              members={membersOf(group.id)}
              links={links}
            />
          )
        )}
      </>
    );
  };
};

export default TableGroups;
