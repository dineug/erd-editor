/** An error the binding raises, its message naming the package it came from. */
export const refusal = (message: string): Error =>
  new Error(`erd-editor-yjs: ${message}`);
