import dts from 'vite-plugin-dts';

import { defineLibraryConfig } from '../../tools/vite/library-config.ts';

export default defineLibraryConfig(import.meta.url, {
  banner: true,
  dts,
  server: {
    // vp dev has no --no-open, so the e2e run turns this off through the
    // environment instead of a CLI flag — the same shape erd-editor uses.
    open: !process.env.E2E,
  },
});
