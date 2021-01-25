import { ERDEditorContext } from './ERDEditorContext';

export interface Panel {
  getElement(): HTMLElement;
  beforeMount?(): void;
  mounted?(): void;
  unmounted?(): void;
  updated?(): void;
}

export interface PanelClass {
  new (api: ERDEditorContext): Panel;
}

export interface Icon {
  prefix: string;
  name: string;
}

export interface PanelConfig {
  type: PanelClass;
  icon: Icon;
  name?: string;
}
