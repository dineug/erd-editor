import type { HostNode } from '@/render/adapter';
import { domHelper, HostHelper, isPromise, noop } from '@/render/helper';
import { Part } from '@/render/part';
import { createPart, getPartType } from '@/render/part/node/text/helper';

export class ObjectPart implements Part {
  #helper: HostHelper;
  #startNode: HostNode;
  #endNode: HostNode;
  #value: any = null;
  #part: Part | null = null;
  #cancel = noop;

  constructor(
    startNode: HostNode,
    endNode: HostNode,
    helper: HostHelper = domHelper
  ) {
    this.#startNode = startNode;
    this.#endNode = endNode;
    this.#helper = helper;
  }

  commit(value: any) {
    if (this.#value === value) return;

    this.clear();
    if (isPromise(value)) {
      this.promiseCommit(value);
    }
  }

  promiseCommit(promise: Promise<any>) {
    const [newPromise, cancel] = cancelPromise(promise);
    this.#cancel = cancel;

    newPromise.then(value => {
      const type = getPartType(value);
      this.#part = createPart(
        type,
        this.#startNode,
        this.#endNode,
        this.#helper
      );
      this.#part?.commit(value);
    });

    this.#value = promise;
  }

  partClear() {
    this.#part?.destroy?.();
    this.#helper.removeRange(this.#startNode, this.#endNode);
  }

  clear() {
    this.#cancel();
    this.partClear();
    this.#cancel = noop;
  }

  destroy() {
    this.clear();
  }
}

function cancelPromise(promise: Promise<any>): [Promise<any>, () => void] {
  let cancelReject = noop;
  const cancelPromise = new Promise((_, reject) => (cancelReject = reject));
  const cancel = () => cancelReject();
  return [Promise.race([cancelPromise, promise]), cancel];
}
