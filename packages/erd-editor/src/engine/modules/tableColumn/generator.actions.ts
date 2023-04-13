import { GeneratorAction } from '@/engine/generator.actions';
import { addColumnAction } from '@/engine/modules/tableColumn/atom.actions';
import { uuid } from '@/utils';

export const addColumn$ = (tableId?: string): GeneratorAction =>
  function* (state) {
    if (tableId) {
      yield addColumnAction({
        id: uuid(),
        tableId,
      });
      return;
    }

    // TODO: selected tables
  };
