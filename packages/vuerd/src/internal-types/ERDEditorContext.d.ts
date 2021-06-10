import { ERDEditorContext } from '@@types/core/ERDEditorContext';

import { EventBus, GlobalEventObservable } from './event.helper';
import { IHelper } from './helper';
import { IStore } from './store';

export interface IERDEditorContext extends ERDEditorContext {
  globalEvent: GlobalEventObservable;
  eventBus: EventBus;
  store: IStore;
  helper: IHelper;
}
