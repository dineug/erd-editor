import {
  WindowEventObservable,
  createWindowEventObservable,
  EventBus,
} from "./Event";
import { Theme, createTheme } from "./Theme";
import { Keymap, createKeymap } from "./Keymap";
import { Store } from "./Store";
import { Helper } from "./Helper";

export interface EditorContext {
  windowEventObservable: WindowEventObservable;
  eventBus: EventBus;
  theme: Theme;
  keymap: Keymap;
  store: Store;
  helper: Helper;
}

export function createEditorContext(): EditorContext {
  return {
    windowEventObservable: createWindowEventObservable(),
    eventBus: new EventBus(),
    theme: createTheme(),
    keymap: createKeymap(),
    store: new Store(),
    helper: new Helper(),
  };
}
