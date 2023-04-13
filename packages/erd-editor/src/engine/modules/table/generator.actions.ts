import { GeneratorAction } from '@/engine/generator.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { nextPoint, nextZIndex, uuid } from '@/utils';

export const addTable$ = (): GeneratorAction =>
  function* ({ settings, collections: { tableEntities, memoEntities } }) {
    const point = nextPoint(settings, tableEntities, memoEntities);

    yield addTableAction({
      id: uuid(),
      ui: {
        x: point.x,
        y: point.y,
        zIndex: nextZIndex(tableEntities, memoEntities),
      },
    });
  };
