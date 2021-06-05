import { ExtensionConfig } from '@@types/core/extension';

import { addPanel } from './panel';

export function extension(config: Partial<ExtensionConfig>) {
  config.panels && addPanel(...config.panels);
}
