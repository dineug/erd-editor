import { query } from '@dineug/erd-editor-schema';
import { FC, repeat } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import Relationship from '@/components/erd/canvas/canvas-svg/relationship/Relationship';
import { RELATIONSHIP_STROKE_WIDTH } from '@/constants/layout';

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

    return (
      <svg
        class={[styles.root, props.class]}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          'min-width': `${width}px`,
          'min-height': `${height}px`,
        }}
      >
        {repeat(
          relationships,
          relationship => relationship.id,
          relationship => (
            <Relationship
              relationship={relationship}
              strokeWidth={props.strokeWidth ?? RELATIONSHIP_STROKE_WIDTH}
            />
          )
        )}
      </svg>
    );
  };
};

export default CanvasSvg;
