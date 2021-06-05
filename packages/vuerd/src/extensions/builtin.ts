import { extension } from '@/core/extension';

import { generatorCodePanelConfig } from './panels/generator-code';
import { gridPanelConfig } from './panels/grid';
import { SQLDDLPanelConfig } from './panels/sql-ddl';
import { visualizationPanelConfig } from './panels/visualization';

extension({
  panels: [
    gridPanelConfig,
    visualizationPanelConfig,
    SQLDDLPanelConfig,
    generatorCodePanelConfig,
  ],
});
