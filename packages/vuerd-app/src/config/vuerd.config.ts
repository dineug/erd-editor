// import 'vuerd';
// import 'vuerd/theme/one-dark-pro.css';
// import { generateTemplatePanel } from '@vuerd/plugin-generate-template';
// import { extension } from 'vuerd';

import get from 'lodash/get';

const { extension } = get(window, 'vuerd');
const { generateTemplatePanel } = get(
  window,
  '@vuerd/plugin-generate-template'
);

extension({
  panels: [generateTemplatePanel()],
});
