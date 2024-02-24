import {
  createContext,
  observable,
  reduxDevtools,
  useContext,
} from '@dineug/r-html';
import { Subject } from 'rxjs';

import { Actions, actions } from '@/engine/actions';
import {
  createEngineContext,
  EngineContext,
  InjectEngineContext,
} from '@/engine/context';
import { initialClearAction } from '@/engine/modules/editor/atom.actions';
import { createRxStore, RxStore, RxStoreOptions } from '@/engine/rx-store';
import { Ctx } from '@/internal-types';
import { Emitter } from '@/utils/emitter';
import {
  createKeyBindingMap,
  KeyBindingMap,
  KeyBindingName,
} from '@/utils/keyboard-shortcut';

export type AppContext = EngineContext & {
  actions: Actions;
  store: RxStore;
  keyBindingMap: KeyBindingMap;
  shortcut$: Subject<{ type: KeyBindingName; event: KeyboardEvent }>;
  keydown$: Subject<KeyboardEvent>;
  emitter: Emitter;
};

export type InjectAppContext = InjectEngineContext;

export function createAppContext(
  ctx: InjectAppContext,
  options?: RxStoreOptions
): AppContext {
  const engineContext = createEngineContext(ctx);
  const store = createRxStore(engineContext, options);
  const keyBindingMap = observable(createKeyBindingMap(), { shallow: true });
  const shortcut$ = new Subject<{
    type: KeyBindingName;
    event: KeyboardEvent;
  }>();
  const keydown$ = new Subject<KeyboardEvent>();
  const emitter = new Emitter();

  if (import.meta.env.DEV) {
    reduxDevtools(store);
  }

  return Object.freeze({
    ...engineContext,
    actions,
    store,
    keyBindingMap,
    shortcut$,
    keydown$,
    emitter,
  });
}

export const appContext = createContext<AppContext>({} as AppContext);

export const useAppContext = (ctx: Ctx, fallback?: AppContext) =>
  useContext(ctx, {
    ...appContext,
    value: fallback ?? appContext.value,
  });

export function appDestroy(app: AppContext) {
  app.store.dispatchSync(initialClearAction());
  app.store.destroy();
  app.keydown$.complete();
  app.shortcut$.complete();
  app.emitter.clear();
}
