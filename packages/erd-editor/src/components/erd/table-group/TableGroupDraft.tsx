import { FC } from '@dineug/r-html';

import type { Rect } from '@/konva/scene/metrics';

import * as styles from './TableGroupDraft.styles';

export type TableGroupDraftProps = {
  /**
   * The draw under way, whose box in the erd root's own pixels this reads
   * itself, so a step of the draw re-renders the box alone and not the root.
   */
  draw: { draft: Rect | null };
};

/** The box a table group draw spans while the pointer travels, the group it adds on release. */
const TableGroupDraft: FC<TableGroupDraftProps> = props => () => {
  const rect = props.draw.draft;
  if (!rect) return null;

  return (
    <div
      class={['table-group-draft', styles.root]}
      style={{
        transform: `translate(${rect.x}px, ${rect.y}px)`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      }}
    ></div>
  );
};

export default TableGroupDraft;
