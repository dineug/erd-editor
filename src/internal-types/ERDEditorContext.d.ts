import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { GlobalEventObservable } from './eventHelper';

export interface IERDEditorContext extends ERDEditorContext {
  globalEvent: GlobalEventObservable;
}
