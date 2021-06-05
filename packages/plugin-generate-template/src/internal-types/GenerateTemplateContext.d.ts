import { GlobalEventObservable } from './event.helper';
import { ERDEditorContext } from 'vuerd';

export interface GenerateTemplateContext {
  api: ERDEditorContext;
  host: ShadowRoot;
  globalEvent: GlobalEventObservable;
}
