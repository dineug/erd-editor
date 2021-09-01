import { ExtensionConfig } from '@@types/core/extension';

import { addPanel, setExcludePanel } from './panel';

export function extension(config: Partial<ExtensionConfig>) {
  config.panels && addPanel(...config.panels);
  config.excludePanel && setExcludePanel(config.excludePanel);
}
