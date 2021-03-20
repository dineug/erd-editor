import { extension } from '@/core/extension';
import { visualizationPanelConfig } from './panels/visualization';
import { SQLDDLPanelConfig } from './panels/sql-ddl';

extension({
  panels: [visualizationPanelConfig, SQLDDLPanelConfig],
});
