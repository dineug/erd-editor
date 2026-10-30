import dts from 'vite-plugin-dts';

import { defineLibraryConfig } from '../../tools/vite/library-config.ts';

const config = defineLibraryConfig(import.meta.url, {
  dts,
  minify: false,
  preserveModules: true,
  server: { port: 5181 },
});

/**
 * What the highlighting SharedWorker a code tab starts imports, as the editor's
 * shikiService names it. Vite's scanner walks no worker entry, so unnamed they
 * are optimized late, once the dev page opens a code tab.
 */
const HIGHLIGHTER_IMPORTS = [
  'shiki/core',
  'shiki/engine/javascript',
  '@shikijs/themes/github-dark',
  '@shikijs/themes/github-light',
  ...[
    'csharp',
    'go',
    'java',
    'json',
    'kotlin',
    'mermaid',
    'php',
    'python',
    'rust',
    'scala',
    'sql',
    'swift',
    'typescript',
  ].map(lang => `@shikijs/langs/${lang}`),
];

// Two copies of yjs in one realm break each other's constructor checks, and the
// dev page imports it itself and reaches it again through y-websocket and y-protocols.
export default {
  ...config,
  resolve: { ...config.resolve, dedupe: ['yjs'] },
  // Named through the editor, since this package depends on none of them.
  optimizeDeps: {
    include: HIGHLIGHTER_IMPORTS.map(id => `@dineug/erd-editor > ${id}`),
  },
};
