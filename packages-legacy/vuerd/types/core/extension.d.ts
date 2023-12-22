import { PanelConfig } from './panel';

export interface ExtensionConfig {
  panels: PanelConfig[];
  excludePanel: RegExp[];
}

export declare function extension(config: Partial<ExtensionConfig>): void;
