import { Theme, createTheme } from "./Theme";

export interface EditorContext {
  theme: Theme;
}

export function createEditorContext(): EditorContext {
  return {
    theme: createTheme()
  };
}
