import { FC, repeat, svg } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import Relationship from '@/components/erd/canvas/canvas-svg/relationship/Relationship';
import { query } from '@/utils/collection/query';

import * as styles from './CanvasSvg.styles';

export type CanvasSvgProps = {
  strokeWidth?: number;
  class?: any;
};

const CanvasSvg: FC<CanvasSvgProps> = (props, ctx) => {
  const app = useAppContext(ctx);

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
            <g class=${[
              'relationship',
              { identification: relationship.identification },
            ]}>
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
