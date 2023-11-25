import { FC, repeat, svg } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import Relationship from '@/components/erd/canvas/canvas-svg/relationship/Relationship';
import { hoverColumnMapAction } from '@/engine/modules/editor/atom.actions';
import { Relationship as RelationshipType } from '@/internal-types';
import { query } from '@/utils/collection/query';

import * as styles from './CanvasSvg.styles';

export type CanvasSvgProps = {
  strokeWidth?: number;
  class?: any;
};

const CanvasSvg: FC<CanvasSvgProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const handleMouseenter = (relationship: RelationshipType) => {
    const { store } = app.value;
    store.dispatch(
      hoverColumnMapAction({
        columnIds: [
          ...relationship.start.columnIds,
          ...relationship.end.columnIds,
        ],
      })
    );
  };

  const handleMouseleave = () => {
    const { store } = app.value;
    store.dispatch(hoverColumnMapAction({ columnIds: [] }));
  };

  return () => {
    const { store } = app.value;
    const {
      settings: { width, height },
      doc: { relationshipIds },
      collections,
    } = store.state;

    const relationships = query(collections)
      .collection('relationshipEntities')
      .selectByIds(relationshipIds);

    return svg`
      <svg
        class=${[styles.root, props.class]}
        style=${{
          width: `${width}px`,
          height: `${height}px`,
          'min-width': `${width}px`,
          'min-height': `${height}px`,
        }}
      >
        ${repeat(
          relationships,
          relationship => relationship.id,
          relationship => svg`
            <g
              class=${[
                'relationship',
                { identification: relationship.identification },
              ]}
              data-id=${relationship.id}
              @mouseenter=${() => handleMouseenter(relationship)}
              @mouseleave=${handleMouseleave}
            >
              <${Relationship}
                relationship=${relationship}
                strokeWidth=${props.strokeWidth ?? 3}
              />
            </g>
          `
        )}
      </svg>
    `;
  };
};

export default CanvasSvg;
