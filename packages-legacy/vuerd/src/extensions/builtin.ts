import { extension } from '@/core/extension';

import { generatorCodePanel } from './panels/generator-code';
import { SQLDDLPanel } from './panels/sql-ddl';
import { visualizationPanel } from './panels/visualization';

extension({
  panels: [visualizationPanel(), SQLDDLPanel(), generatorCodePanel()],
});
