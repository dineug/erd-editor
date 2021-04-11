import { extension } from '@/core/extension';
import { visualizationPanelConfig } from './panels/visualization';
import { SQLDDLPanelConfig } from './panels/sql-ddl';
import { generatorCodePanelConfig } from './panels/generator-code';
import { gridPanelConfig } from './panels/grid';

extension({
  panels: [
    gridPanelConfig,
    visualizationPanelConfig,
    SQLDDLPanelConfig,
    generatorCodePanelConfig,
  ],
});
