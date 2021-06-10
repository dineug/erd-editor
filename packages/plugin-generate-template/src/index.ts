import { mdiFileCog } from '@mdi/js';
import { addIcon, PanelConfig } from 'vuerd';

import { GenerateTemplatePanel } from '@/components';
import { createMDI } from '@/core/icon';

addIcon(createMDI('file-cog', mdiFileCog));

export const generateTemplatePanelConfig: PanelConfig = {
  type: GenerateTemplatePanel,
  icon: {
    prefix: 'mdi',
    name: 'file-cog',
    size: 20,
  },
  key: 'generate-template',
  name: 'Generate Template',
};
