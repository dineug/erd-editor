import dts from 'vite-plugin-dts';

import { defineLibraryConfig } from '../../tools/vite/library-config.ts';

export default defineLibraryConfig(import.meta.url, { dts });
