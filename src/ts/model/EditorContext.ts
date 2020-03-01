import { Theme, createTheme } from "./Theme";
import { Canvas, createCanvas } from "./Canvas";
import { WindowEventObservable, createWindowEventObservable } from "./Event";

export interface EditorContext {
  theme: Theme;
  canvas: Canvas;
  windowEventObservable: WindowEventObservable;
}

export function createEditorContext(): EditorContext {
  return {
    theme: createTheme(),
    canvas: createCanvas(),
    windowEventObservable: createWindowEventObservable()
  };
}
