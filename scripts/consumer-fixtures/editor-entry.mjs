// The app's shape: the entry that defines the editor, then a named import from
// the package root.
import '@dineug/erd-editor/erd-editor.js';

import { createKeyBindingMap } from '@dineug/erd-editor';

globalThis.__consumerProbe = typeof createKeyBindingMap;
