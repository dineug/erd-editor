// The package root defines no tag, so a named import from it registers nothing.
import { createKeyBindingMap } from '@dineug/erd-editor';

globalThis.__consumerProbe = typeof createKeyBindingMap;
