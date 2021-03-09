import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { GlobalEventObservable, EventBus } from './event.helper';
import { IStore } from './store';
import { IHelper } from './helper';

export interface IERDEditorContext extends ERDEditorContext {
  globalEvent: GlobalEventObservable;
  eventBus: EventBus;
  store: IStore;
  helper: IHelper;
}
