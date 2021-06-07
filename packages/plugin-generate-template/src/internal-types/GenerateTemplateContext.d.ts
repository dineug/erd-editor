import { ERDEditorContext } from 'vuerd';

import { UIStore } from '@/stores/ui.store';

import { GlobalEventObservable } from './event.helper';

export interface GenerateTemplateContext {
  api: ERDEditorContext;
  host: ShadowRoot;
  globalEvent: GlobalEventObservable;
  stores: {
    ui: UIStore;
  };
}
