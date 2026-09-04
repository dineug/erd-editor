export type { FakeHost, FakeHostOps } from '@/render/__fake-host__/adapter';
export { createFakeHost } from '@/render/__fake-host__/adapter';
export type {
  FakeListener,
  FakeNode,
  FakeNodeKind,
} from '@/render/__fake-host__/tree';
export {
  childrenOf,
  createFakeNode,
  detach,
  dispatchFakeEvent,
  insertInto,
  isFakeNode,
  serialize,
  textOf,
} from '@/render/__fake-host__/tree';
