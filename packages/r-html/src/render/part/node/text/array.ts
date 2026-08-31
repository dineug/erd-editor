import type { HostNode } from '@/render/adapter';
import { domHelper, HostHelper } from '@/render/helper';
import { Part } from '@/render/part';
import {
  Action,
  difference,
  partsToDiffItems,
  valuesToDiffItems,
} from '@/render/part/node/text/arrayDiff';
import {
  createPart,
  getPartType,
  PartType,
} from '@/render/part/node/text/helper';

export class ArrayPart implements Part {
  #helper: HostHelper;
  #startNode: HostNode;
  #endNode: HostNode;
  #parts: ItemPart[] = [];

  constructor(
    startNode: HostNode,
    endNode: HostNode,
    helper: HostHelper = domHelper
  ) {
    this.#startNode = startNode;
    this.#endNode = endNode;
    this.#helper = helper;
  }

  commit(values: any[]) {
    const diff = difference(
      partsToDiffItems(this.#parts),
      valuesToDiffItems(values)
    );
    const arrayLike: any = { length: values.length };

    diff.update.forEach(({ action, from, to }) => {
      switch (action) {
        case Action.create:
          const node = this.#helper.createMarker('');

          to === 0
            ? this.#helper.insertAfterNode(node, this.#startNode)
            : this.#parts.length
              ? this.#helper.insertAfterNode(
                  node,
                  arrayLike[to - 1]
                    ? arrayLike[to - 1].endNode
                    : this.#parts[to - 1].endNode
                )
              : this.#helper.insertBeforeNode(node, this.#endNode);

          arrayLike[to] = new ItemPart(node, values[to], this.#helper);
          break;
        case Action.move:
          arrayLike[to] = this.#parts[from];
          if (to === from) return;

          to === 0
            ? this.#parts[from].insert('after', this.#startNode)
            : this.#parts[from].insert(
                'after',
                arrayLike[to - 1]
                  ? arrayLike[to - 1].endNode
                  : this.#parts[to - 1].endNode
              );
          break;
      }
    });
    diff.delete.forEach(({ from }) => this.#parts[from].destroy());

    this.#parts = Array.from(arrayLike);
    this.#parts.forEach((part, index) => part.commit(values[index]));
  }

  destroy() {
    this.#parts.forEach(part => part.destroy());
  }
}

export class ItemPart implements Part {
  #part: Part;
  #helper: HostHelper;
  // The boundary markers stay DOM typed: they are read as nodes from outside.
  startNode: Comment;
  endNode: Comment;
  type: PartType;
  value: any;

  constructor(node: HostNode, value: any, helper: HostHelper = domHelper) {
    this.#helper = helper;
    this.startNode = helper.createMarker('') as Comment;
    this.endNode = helper.createMarker('') as Comment;
    helper.insertBeforeNode(this.startNode, node);
    helper.insertAfterNode(this.endNode, node);
    helper.removeNode(node);
    this.value = value;
    this.type = getPartType(value);
    this.#part = createPart(this.type, this.startNode, this.endNode, helper);
  }

  commit(value: any) {
    this.#part.commit(value);
    this.value = value;
  }

  insert(position: 'before' | 'after', refChild: HostNode) {
    const nodes = [
      this.startNode,
      ...this.#helper.rangeNodes(this.startNode, this.endNode),
      this.endNode,
    ];

    position === 'before'
      ? nodes.forEach(node => this.#helper.insertBeforeNode(node, refChild))
      : nodes
          .reverse()
          .forEach(node => this.#helper.insertAfterNode(node, refChild));
  }

  destroy() {
    this.#part.destroy?.();
    this.#helper
      .rangeNodes(this.startNode, this.endNode)
      .forEach(node => this.#helper.removeNode(node));
    this.#helper.removeNode(this.startNode);
    this.#helper.removeNode(this.endNode);
  }
}
