import dts from 'vite-plugin-dts';

import { defineLibraryConfig } from '../../tools/vite/library-config.ts';

export default defineLibraryConfig(import.meta.url, {
  dts,
  jsx: { konvaImportSource: '@dineug/r-html-konva' },
  minify: false,
  preserveModules: true,
  server: {
    // vp dev has no --no-open, so the bench run turns this off through the
    // environment instead of a CLI flag, the same shape r-html uses.
    open: !process.env.E2E,
  },
});
