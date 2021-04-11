import { PanelConfig } from './panel';

export interface ExtensionConfig {
  panels: PanelConfig[];
}

export declare function extension(config: Partial<ExtensionConfig>): void;
