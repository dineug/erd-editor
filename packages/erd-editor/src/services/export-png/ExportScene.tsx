/** @jsxHost konva */

import { query } from '@dineug/erd-editor-schema';
import { FC, repeat } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import Memo from '@/components/erd/canvas/memo/Memo';
import RelationshipGroup from '@/components/erd/canvas/relationship-group/RelationshipGroup';
import Table from '@/components/erd/canvas/table/Table';
import { useThemeContext } from '@/components/themeContext';
import { Show } from '@/constants/schema';
import { bHas } from '@/utils/bit';

export type ExportSceneProps = {};

type Stacked = { ui: { zIndex: number } };

const byZIndex = (a: Stacked, b: Stacked) => a.ui.zIndex - b.ui.zIndex;

/**
 * The whole canvas box on one layer, with no culling and no zoom. An exported
 * image is not a picture of the screen, so nothing here reads the scroll, the
 * zoom or the viewport the editor's own scene is placed with.
 */
const ExportScene: FC<ExportSceneProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);

  return () => {
    const { store } = app.value;
    const {
      settings: { show, width, height },
      doc: { tableIds, memoIds, relationshipIds },
      collections,
    } = store.state;
    const theme = themeRef.value;

    const tables = query(collections)
      .collection('tableEntities')
      .selectByIds(tableIds)
      .sort(byZIndex);

    const memos = query(collections)
      .collection('memoEntities')
      .selectByIds(memoIds)
      .sort(byZIndex);

    const relationships = query(collections)
      .collection('relationshipEntities')
      .selectByIds(relationshipIds);

    return (
      <k-layer name="export-scene" listening={false}>
        <k-rect
          name="export-background"
          x={0}
          y={0}
          width={width}
          height={height}
          fill={theme.canvasBackground}
        />
        {bHas(show, Show.relationship) ? (
          <RelationshipGroup relationships={relationships} />
        ) : null}
        {repeat(
          tables,
          table => table.id,
          table => (
            <Table table={table} />
          )
        )}
        {repeat(
          memos,
          memo => memo.id,
          memo => (
            <Memo memo={memo} />
          )
        )}
      </k-layer>
    );
  };
};

export default ExportScene;
