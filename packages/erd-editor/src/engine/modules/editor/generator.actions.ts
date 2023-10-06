import { GeneratorAction } from '@/engine/generator.actions';
import {
  clearAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';

export const loadJson$ = (value: string): GeneratorAction =>
  function* () {
    yield clearAction();
    yield loadJsonAction({ value });
  };

export const actions$ = {
  loadJson$,
};
