import { toDocumentJson, toJson } from '@dineug/erd-editor-schema';

import { RootState } from '@/engine/state';

type HasState = { readonly state: RootState };

/**
 * The state with the document's own value of each setting a readonly
 * reader's screen holds over, on a copy of the settings; the state itself
 * while no screen is held.
 */
export function withScreenBaseline(state: RootState): RootState {
  const baseline = state.editor.screenBaseline;
  if (!baseline) return state;

  const { viewport, ...settings } = baseline;
  return {
    ...state,
    settings: { ...state.settings, ...viewport, ...settings },
  };
}

/** The file form of the store's document, which the element's value and a JSON export write. */
export const documentJsonOf = ({ state }: HasState): string =>
  toDocumentJson(withScreenBaseline(state));

/** The runtime value of the store's document, which the element's runtimeValue hands a collaborator. */
export const runtimeJsonOf = ({ state }: HasState): string =>
  toJson(withScreenBaseline(state));
