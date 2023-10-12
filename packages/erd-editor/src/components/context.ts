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
import { createRxStore, RxStore } from '@/engine/rx-store';
import {
  createKeyBindingMap,
  KeyBindingMap,
  KeyBindingName,
} from '@/utils/keyboard-shortcut';

export type AppContext = EngineContext & {
  actions: Actions;
  store: RxStore;
  keyBindingMap: KeyBindingMap;
  shortcut$: Subject<KeyBindingName>;
  keydown$: Subject<KeyboardEvent>;
};

export type InjectAppContext = InjectEngineContext;

export function createAppContext(ctx: InjectAppContext): AppContext {
  const engineContext = createEngineContext(ctx);
  const store = createRxStore(engineContext);
  const keyBindingMap = observable(createKeyBindingMap(), { shallow: true });
  const shortcut$ = new Subject<KeyBindingName>();
  const keydown$ = new Subject<KeyboardEvent>();

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
  });
}

export const appContext = createContext<AppContext>({} as AppContext);

export const useAppContext = (ctx: Parameters<typeof useContext>[0]) =>
  useContext(ctx, appContext);
