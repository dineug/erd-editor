import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { GlobalEventObservable } from './event.helper';
import { IStore } from './store';

export interface IERDEditorContext extends ERDEditorContext {
  globalEvent: GlobalEventObservable;
  store: IStore;
}
