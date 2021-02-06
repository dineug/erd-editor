import { ERDEditorContext } from './ERDEditorContext';

export interface Panel {
  render(): HTMLElement;
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
  size?: number;
}

export interface PanelConfig {
  type: PanelClass;
  icon: Icon;
  name?: string;
  key: string;
}
