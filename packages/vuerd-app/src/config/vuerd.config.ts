import 'vuerd';

import { generateTemplatePanel } from '@vuerd/plugin-generate-template';
import { extension } from 'vuerd';

extension({
  panels: [generateTemplatePanel()],
});
