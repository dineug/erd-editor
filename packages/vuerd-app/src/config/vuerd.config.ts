import 'vuerd';
import 'vuerd/theme/one-dark-pro.css';

import { generateTemplatePanel } from '@vuerd/plugin-generate-template';
import { extension } from 'vuerd';

extension({
  panels: [generateTemplatePanel()],
});
