/**
 * What ELK's bundle looks for before deciding it is the worker script itself.
 * With no document and a self it installs an onmessage handler and exports
 * nothing, and the wrapper reading its Worker export then builds undefined.
 */
const DOCUMENT_STUB = {};

// A realm that has a document needs none of this, and ELK reads nothing off
// the stub: the one branch it takes is a typeof against the global.
if (typeof document === 'undefined') {
  Reflect.set(globalThis, 'document', DOCUMENT_STUB);
}
