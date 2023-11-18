import { isPromise, noop, rangeNodes, removeNode } from '@/render/helper';
import { Part } from '@/render/part';
import { createPart, getPartType } from '@/render/part/node/text/helper';

export class ObjectPart implements Part {
  #startNode: Comment;
  #endNode: Comment;
  #value: any = null;
  #part: Part | null = null;
  #cancel = noop;

  constructor(startNode: Comment, endNode: Comment) {
    this.#startNode = startNode;
    this.#endNode = endNode;
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
      this.#part = createPart(type, this.#startNode, this.#endNode);
      this.#part?.commit(value);
    });

    this.#value = promise;
  }

  partClear() {
    this.#part?.destroy?.();
    rangeNodes(this.#startNode, this.#endNode).forEach(removeNode);
  }

  clear() {
    this.#cancel();
    this.#part?.destroy?.();
    rangeNodes(this.#startNode, this.#endNode).forEach(removeNode);
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
