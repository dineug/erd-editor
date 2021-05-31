import { PanelConfig, addIcon } from 'vuerd';
import { mdiFileCog } from '@mdi/js';
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
