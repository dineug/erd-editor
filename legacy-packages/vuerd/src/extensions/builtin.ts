import { extension } from '@/core/extension';

import { generatorCodePanel } from './panels/generator-code';
import { gridPanel } from './panels/grid';
import { SQLDDLPanel } from './panels/sql-ddl';
import { visualizationPanel } from './panels/visualization';

extension({
  panels: [
    gridPanel(),
    visualizationPanel(),
    SQLDDLPanel(),
    generatorCodePanel(),
  ],
});
