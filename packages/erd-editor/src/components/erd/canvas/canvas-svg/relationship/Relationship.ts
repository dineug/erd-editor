import { FC, nextTick, observable, svg } from '@dineug/r-html';
import { debounce } from 'lodash-es';

import { useAppContext } from '@/components/appContext';
import { StartRelationshipType } from '@/constants/schema';
import { hoverColumnMapAction } from '@/engine/modules/editor/atom.actions';
import { type Point, Relationship as RelationshipType } from '@/internal-types';
import { getRelationshipPath } from '@/utils/draw-relationship/pathFinding';
import { calcPathFindingAction } from '@/utils/emitter';

import { relationshipShape } from './Relationship.template';

export type RelationshipProps = {
  relationship: RelationshipType;
  strokeWidth: number;
};

const Relationship: FC<RelationshipProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const state = observable<{
    lines: Array<[Point, Point]>;
  }>({
    lines: [],
  });

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

  let commitCalcPathFinding = false;

  const resolve = (lines: Array<[Point, Point]>) => {
    if (!lines.length) {
      return;
    }

    commitCalcPathFinding = true;
    state.lines = lines;
    nextTick(() => {
      commitCalcPathFinding = false;
    });
  };

  const calcPathFinding = debounce(
    (
      payload: Omit<
        ReturnType<typeof calcPathFindingAction>['payload'],
        'resolve'
      >
    ) => {
      const { emitter } = app.value;
      emitter.emit(
        calcPathFindingAction({
          ...payload,
          resolve,
        })
      );
    },
    300
  );

  return () => {
    const { store } = app.value;
    const { editor } = store.state;
    const { relationship, strokeWidth } = props;
    const relationshipPath = getRelationshipPath(relationship);
    const { path, line } = relationshipPath;
    const calcLines = state.lines;
    const lines = commitCalcPathFinding ? calcLines : path.path.d();
    const shape = relationshipShape(
      relationship.relationshipType,
      relationshipPath
    );
    const hover = Boolean(editor.hoverRelationshipMap[relationship.id]);

    if (
      !commitCalcPathFinding &&
      relationship.start.tableId !== relationship.end.tableId
    ) {
      calcPathFinding({
        id: relationship.id,
        start: path.path.M,
        end: path.path.L,
      });
    }

    return svg`
      <g
        class=${[
          'relationship',
          { identification: relationship.identification },
        ]}
        data-id=${relationship.id}
        ?data-hover=${hover}
        @mouseenter=${() => handleMouseenter(relationship)}
        @mouseleave=${handleMouseleave}
      >
        ${lines.map(
          ([a, b]) =>
            svg`
              <line
                x1=${a.x} y1=${a.y}
                x2=${b.x} y2=${b.y}
                stroke-dasharray=${relationship.identification ? 0 : 10}
                stroke-width=${strokeWidth}
                fill="transparent"
              ></line>
            `
        )}
        <line
          x1=${path.line.start.x1} y1=${path.line.start.y1}
          x2=${path.line.start.x2} y2=${path.line.start.y2}
          stroke-width="3"
        ></line>
        <line
          x1=${line.line.start.base.x1} y1=${line.line.start.base.y1}
          x2=${line.line.start.base.x2} y2=${line.line.start.base.y2}
          stroke-width="3"
        ></line>
        ${
          relationship.startRelationshipType === StartRelationshipType.ring
            ? svg`
              <circle
                cx=${line.startCircle.cx} cy=${line.startCircle.cy} r="8"
                fill-opacity="0.0"
                stroke-width="3"
              ></circle>
              <line
                x1=${line.line.start.center.x1} y1=${line.line.start.center.y1}
                x2=${line.line.start.center.x2} y2=${line.line.start.center.y2}
                stroke-width="3"
              ></line>
        `
            : svg`
              <line
                x1=${line.line.start.base2.x1} y1=${line.line.start.base2.y1}
                x2=${line.line.start.base2.x2} y2=${line.line.start.base2.y2}
                stroke-width="3"
              ></line>
              <line
                x1=${line.line.start.center2.x1} y1=${line.line.start.center2.y1}
                x2=${line.line.start.center2.x2} y2=${line.line.start.center2.y2}
                stroke-width="3"
              ></line>
        `
        }
        ${shape}
      </g>
    `;
  };
};

export default Relationship;
