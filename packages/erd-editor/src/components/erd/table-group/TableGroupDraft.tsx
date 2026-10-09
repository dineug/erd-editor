import { FC } from '@dineug/r-html';

import type { Rect } from '@/konva/scene/metrics';

import * as styles from './TableGroupDraft.styles';

export type TableGroupDraftProps = {
  /** The box in the erd root's own pixels. */
  rect: Rect;
};

/** The box a table group draw spans while the pointer travels, the group it adds on release. */
const TableGroupDraft: FC<TableGroupDraftProps> = props => () => (
  <div
    class={['table-group-draft', styles.root]}
    style={{
      transform: `translate(${props.rect.x}px, ${props.rect.y}px)`,
      width: `${props.rect.width}px`,
      height: `${props.rect.height}px`,
    }}
  ></div>
);

export default TableGroupDraft;
