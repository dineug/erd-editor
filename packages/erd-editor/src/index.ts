import '@/components/customElementRegistry';

import { hmr } from '@dineug/r-html';

/**
 * Hot module replacement, switched on by whichever build consumes this file:
 * true under `vp dev`, false in the published bundle, where the call and its
 * import are then dropped.
 *
 * The flag cannot live inside r-html. That package ships a prebuilt `dist`, and
 * its own production build freezes `import.meta.env.DEV` to `false` before any
 * consumer ever sees it — so the decision has to be made here, in the package
 * the dev server actually compiles from source.
 *
 * It also has to happen at import time rather than on first swap: `hmr()` is
 * what lets `addHmrObservable` start recording, and a component that mounted
 * before recording began has no state to carry across its first reload.
 */
if (import.meta.env.DEV) {
  hmr();
}

export type { ErdEditorElement } from '@/components/erd-editor/ErdEditor';
export { setGetShikiServiceCallback } from '@/services/shikiService';
export { setExportFileCallback } from '@/utils/file/exportFile';
export { setImportFileCallback } from '@/utils/file/importFile';
