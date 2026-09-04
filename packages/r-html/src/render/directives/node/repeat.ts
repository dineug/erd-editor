import type { HostNode } from '@/render/adapter';
import {
  createNodeDirective,
  NodeDirectiveProps,
} from '@/render/directives/nodeDirective';
import { domHelper, HostHelper } from '@/render/helper';
import { Part } from '@/render/part';
import {
  Action,
  difference,
  DiffItem,
  DiffValue,
} from '@/render/part/node/text/arrayDiff';
import {
  createPart,
  getPartType,
  PartType,
} from '@/render/part/node/text/helper';

type RepeatFn = <T>(
  list: T[],
  getKey: (value: T) => any,
  getResult: (value: T, index: number, array: T[]) => any
) => [T[], (value: T) => any, (value: T, index: number, array: T[]) => any];

export const repeat = createNodeDirective<RepeatFn>(
  <T>(
    list: T[],
    getKey: (value: T) => any,
    getResult: (value: T, index: number, array: T[]) => any
  ) => {
    list.length; // observable dependency
    return [list, getKey, getResult];
  },
  ({ startNode, endNode, helper = domHelper }: NodeDirectiveProps) => {
    let parts: ItemPart[] = [];

    const destroy = () => {
      parts.forEach(part => part.destroy());
    };

    return ([list, getKey, getResult]) => {
      const newDiffValue = valuesToDiffItems(list, getKey, getResult);
      const values = newDiffValue.values;
      const diff = difference(partsToDiffItems(parts), newDiffValue, {
        strict: true,
      });
      const arrayLike: any = { length: values.length };

      diff.update.forEach(({ action, from, to }) => {
        switch (action) {
          case Action.create:
            const node = helper.createMarker('');

            to === 0
              ? helper.insertAfterNode(node, startNode)
              : parts.length
                ? helper.insertAfterNode(
                    node,
                    arrayLike[to - 1]
                      ? arrayLike[to - 1].endNode
                      : parts[to - 1].endNode
                  )
                : helper.insertBeforeNode(node, endNode);

            arrayLike[to] = new ItemPart(
              node,
              values[to].value,
              values[to].key,
              helper
            );
            break;
          case Action.move:
            arrayLike[to] = parts[from];
            if (to === from) return;

            to === 0
              ? parts[from].insert('after', startNode)
              : parts[from].insert(
                  'after',
                  arrayLike[to - 1]
                    ? arrayLike[to - 1].endNode
                    : parts[to - 1].endNode
                );
            break;
        }
      });
      diff.delete.forEach(({ from }) => parts[from].destroy());

      parts = Array.from(arrayLike);
      parts.forEach((part, index) => part.commit(values[index].value));

      return destroy;
    };
  }
) as unknown as RepeatFn;

class ItemPart implements Part {
  #part: Part;
  #helper: HostHelper;
  startNode: HostNode;
  endNode: HostNode;
  type: PartType;
  key: any;

  constructor(
    node: HostNode,
    value: any,
    key: any,
    helper: HostHelper = domHelper
  ) {
    this.#helper = helper;
    this.startNode = helper.createMarker('');
    this.endNode = helper.createMarker('');
    helper.insertBeforeNode(this.startNode, node);
    helper.insertAfterNode(this.endNode, node);
    helper.removeNode(node);
    this.key = key;
    this.type = getPartType(value);
    this.#part = createPart(this.type, this.startNode, this.endNode, helper);
  }

  commit(value: any) {
    this.#part.commit(value);
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
    this.#helper.removeRange(this.startNode, this.endNode);
    this.#helper.removeNode(this.startNode);
    this.#helper.removeNode(this.endNode);
  }
}

function partsToDiffItems(parts: ItemPart[]): DiffValue {
  const items: DiffItem[] = [];
  const itemToIndex = new Map<DiffItem, number>();

  parts.forEach(({ type, key }, index) => {
    const item = { type, key };

    items.push(item);
    itemToIndex.set(item, index);
  });

  return {
    items,
    itemToIndex,
  };
}

function valuesToDiffItems<T>(
  list: T[],
  getKey: (value: T) => any,
  getResult: (value: T, index: number, array: T[]) => any
): DiffValue & { values: Array<{ key: any; value: any }> } {
  const items: DiffItem[] = [];
  const itemToIndex = new Map<DiffItem, number>();
  const values: Array<{ key: any; value: any }> = [];

  list.forEach((value, index, array) => {
    const newValue = {
      key: getKey(value),
      value: getResult(value, index, array),
    };
    const item = { type: getPartType(newValue.value), key: newValue.key };

    values.push(newValue);
    items.push(item);
    itemToIndex.set(item, index);
  });

  return {
    items,
    itemToIndex,
    values,
  };
}
