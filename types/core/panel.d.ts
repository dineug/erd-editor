import { ERDEditorContext } from './ERDEditorContext';

export interface Panel {
  render(): HTMLElement;
  beforeMount?(): void;
  mounted?(): void;
  unmounted?(): void;
  beforeFirstUpdate?(): void;
  firstUpdated?(): void;
  beforeUpdate?(): void;
  updated?(): void;
}

export interface PanelProps {
  width: number;
  height: number;
}

export interface PanelClass {
  new (props: PanelProps, api: ERDEditorContext): Panel;
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
