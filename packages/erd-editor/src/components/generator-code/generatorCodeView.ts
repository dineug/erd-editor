import { observable } from '@dineug/r-html';

import type { AppContext } from '@/components/appContext';
import {
  type PanelView,
  togglePanel,
} from '@/components/schema-sql/schemaSQLView';
import type { RxStore } from '@/engine/rx-store';

/** Whether the Code Generator's options panel shows, apart from the Schema SQL tab's. */
export type GeneratorCodeView = PanelView;

const views = new WeakMap<RxStore, GeneratorCodeView>();

/**
 * The window's own Code Generator state: never in the store, the file or a
 * change event, kept across tab switches until the element goes, one per editor.
 */
export function generatorCodeViewOf({
  store,
}: Pick<AppContext, 'store'>): GeneratorCodeView {
  let view = views.get(store);

  if (!view) {
    view = observable<GeneratorCodeView>({ panel: 'unset' });
    views.set(store, view);
  }

  return view;
}

/** Folds the Code Generator panel away or opens it; one not measured yet opens. */
export function toggleGeneratorCodePanel(app: Pick<AppContext, 'store'>) {
  togglePanel(generatorCodeViewOf(app), app.store.state.editor.viewport.width);
}
