import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { GlobalEventObservable } from './event.helper';
import { IStore } from './store';
import { IHelper } from './helper';

export interface IERDEditorContext extends ERDEditorContext {
  globalEvent: GlobalEventObservable;
  store: IStore;
  helper: IHelper;
}
