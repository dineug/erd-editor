/** @jsxHost konva */

import { query } from '@dineug/erd-editor-schema';
import { FC, repeat } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import Memo from '@/components/erd/canvas/memo/Memo';
import RelationshipGroup from '@/components/erd/canvas/relationship-group/RelationshipGroup';
import Table from '@/components/erd/canvas/table/Table';
import TableGroups from '@/components/erd/canvas/table-group/TableGroups';
import { useThemeContext } from '@/components/themeContext';
import { Show } from '@/constants/schema';
import type { Rect } from '@/konva/scene/metrics';
import { stackedKey, stackTablesAndMemos } from '@/konva/scene/stacking';
import { bHas } from '@/utils/bit';
import { isMemoShown } from '@/utils/memo';
import { isTableGroupShown } from '@/utils/tableGroup';

export type ExportSceneProps = {
  /** The scene box the image holds, margin included, in scene units. */
  box: Rect;
  /** What the box is scaled by so a canvas can hold the raster of it. */
  scale: number;
};

/**
 * Everything the document draws on one layer, the groups behind it all, with
 * no culling and every table in full, as at the export's zoom. The scroll and
 * the viewport do not reach it, so the whole document is held, no check marked.
 */
const ExportScene: FC<ExportSceneProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);

  return () => {
    const { store } = app.value;
    const { box, scale } = props;
    const {
      settings: { show },
      doc: { tableIds, memoIds, relationshipIds },
      collections,
    } = store.state;
    const theme = themeRef.value;

    const stack = stackTablesAndMemos(
      query(collections).collection('tableEntities').selectByIds(tableIds),
      isMemoShown(store.state)
        ? query(collections).collection('memoEntities').selectByIds(memoIds)
        : []
    );

    const relationships = query(collections)
      .collection('relationshipEntities')
      .selectByIds(relationshipIds);

    return (
      <k-layer
        name="export-scene"
        listening={false}
        x={-box.x * scale}
        y={-box.y * scale}
        scaleX={scale}
        scaleY={scale}
      >
        <k-rect
          name="export-background"
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          fill={theme.canvasBackground}
        />
        {isTableGroupShown(store.state) ? <TableGroups /> : null}
        {bHas(show, Show.relationship) ? (
          <RelationshipGroup relationships={relationships} />
        ) : null}
        {repeat(stack, stackedKey, item =>
          item.kind === 'table' ? (
            <Table table={item.entity} checkMarks={false} />
          ) : (
            <Memo memo={item.entity} />
          )
        )}
      </k-layer>
    );
  };
};

export default ExportScene;
