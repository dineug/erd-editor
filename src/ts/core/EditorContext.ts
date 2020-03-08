import {
  WindowEventObservable,
  createWindowEventObservable,
  EventBus
} from "./Event";
import { Theme, createTheme } from "./Theme";
import { Store } from "./Store";

export interface EditorContext {
  windowEventObservable: WindowEventObservable;
  eventBus: EventBus;
  theme: Theme;
  store: Store;
}

export function createEditorContext(): EditorContext {
  return {
    windowEventObservable: createWindowEventObservable(),
    eventBus: new EventBus(),
    theme: createTheme(),
    store: new Store()
  };
}
