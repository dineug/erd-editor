import { getShikiService } from '@dineug/erd-editor-shiki-worker';

const LAZY_KEY = Symbol.for('@dineug/erd-editor');
const { setGetShikiServiceCallback } = Reflect.get(globalThis, LAZY_KEY);
Reflect.deleteProperty(globalThis, LAZY_KEY);

setGetShikiServiceCallback?.(getShikiService);
