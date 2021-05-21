import { PanelConfig, addIcon } from 'vuerd';
import { mdiFileCog } from '@mdi/js';
import { GenerateTemplatePanel } from '@/components';

addIcon({
  prefix: 'mdi',
  iconName: 'file-cog',
  icon: [24, 24, , , mdiFileCog],
});

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
