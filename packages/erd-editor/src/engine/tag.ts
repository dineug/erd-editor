import {
  AnyAction,
  CompositionActions,
  compositionActionsFlat,
} from '@dineug/r-html';
import { isInteger } from '@dineug/shared';
import { cloneDeep } from 'es-toolkit';

import { GeneratorAction } from '@/engine/generator.actions';

export const Tag = {
  shared: 1,
  changeOnly: 2,
  following: 4,
} as const;

export function attachActionTag(tag: number, action: AnyAction): AnyAction {
  return {
    ...cloneDeep(action),
    tags: isInteger(action.tags) ? action.tags | tag : tag,
  };
}

export function attachActionsTag(
  tag: number,
  actions: AnyAction[]
): AnyAction[] {
  return actions.map(action => attachActionTag(tag, action));
}

const createAttachActionsTag =
  (tag: number) =>
  (...compositionActions: CompositionActions): GeneratorAction =>
    function* (state, ctx) {
      const actions = compositionActionsFlat(state, ctx, compositionActions);
      yield attachActionsTag(tag, actions);
    };

export const attachChangeOnlyTag$ = createAttachActionsTag(Tag.changeOnly);
