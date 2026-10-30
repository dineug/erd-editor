import dts from 'vite-plugin-dts';

import { defineLibraryConfig } from '../../tools/vite/library-config.ts';

const config = defineLibraryConfig(import.meta.url, {
  dts,
  minify: false,
  preserveModules: true,
  server: { port: 5179 },
});

// Two copies of yjs in one realm break each other's constructor checks, and the
// dev page imports it itself and reaches it again through y-websocket and y-protocols.
export default {
  ...config,
  resolve: { ...config.resolve, dedupe: ['yjs'] },
};
