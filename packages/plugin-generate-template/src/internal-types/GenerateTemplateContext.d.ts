import { ERDEditorContext } from 'vuerd';

import { GlobalEventObservable } from './event.helper';

export interface GenerateTemplateContext {
  api: ERDEditorContext;
  host: ShadowRoot;
  globalEvent: GlobalEventObservable;
}
