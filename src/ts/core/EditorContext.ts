import { WindowEventObservable, createWindowEventObservable } from "./Event";
import { Theme, createTheme } from "./Theme";
import { Store } from "./Store";

export interface EditorContext {
  windowEventObservable: WindowEventObservable;
  theme: Theme;
  store: Store;
}

export function createEditorContext(): EditorContext {
  return {
    windowEventObservable: createWindowEventObservable(),
    theme: createTheme(),
    store: new Store()
  };
}
