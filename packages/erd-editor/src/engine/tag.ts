import {
  AnyAction,
  CompositionActions,
  compositionActionsFlat,
} from '@dineug/r-html';
import { isInteger } from '@dineug/shared';
import { cloneDeep } from 'lodash-es';

import { GeneratorAction } from '@/engine/generator.actions';

export const Tag = {
  shared: /* */ 0b0000000000000000000000000000001,
} as const;

export function attachActionTag(
  tag: number,
  actions: AnyAction[]
): AnyAction[] {
  return actions.map(action => ({
    ...cloneDeep(action),
    tags: isInteger(action.tags) ? action.tags | tag : tag,
  }));
}

const createAttachActionTag =
  (tag: number) =>
  (...compositionActions: CompositionActions): GeneratorAction =>
    function* (state, ctx) {
      const actions = compositionActionsFlat(state, ctx, compositionActions);
      yield attachActionTag(tag, actions);
    };

export const attachSharedTag$ = createAttachActionTag(Tag.shared);
