import { ItemPart } from '@/render/part/node/text/array';
import { getPartType, PartType } from '@/render/part/node/text/helper';

export enum Action {
  create = 'create',
  move = 'move',
}

export type DiffItem = {
  type: PartType;
  key: any;
};

type Position = {
  from: number;
  to: number;
};

type Diff = {
  update: Array<Position & { action: Action }>;
  delete: Array<Pick<Position, 'from'>>;
};

export type DiffValue = {
  items: DiffItem[];
  itemToIndex: Map<DiffItem, number>;
};

export function partsToDiffItems(parts: ItemPart[]): DiffValue {
  const items: DiffItem[] = [];
  const itemToIndex = new Map<DiffItem, number>();

  parts.forEach(({ type, value }, index) => {
    const item = {
      type,
      key: type === PartType.templateLiterals ? value.strings : value,
    };

    items.push(item);
    itemToIndex.set(item, index);
  });

  return {
    items,
    itemToIndex,
  };
}

export function valuesToDiffItems(values: any[]): DiffValue {
  const items: DiffItem[] = [];
  const itemToIndex = new Map<DiffItem, number>();

  values.forEach((value, index) => {
    const type = getPartType(value);
    const item = {
      type,
      key: type === PartType.templateLiterals ? value.strings : value,
    };

    items.push(item);
    itemToIndex.set(item, index);
  });

  return {
    items,
    itemToIndex,
  };
}

type DifferenceOptions = {
  strict?: boolean;
};

export function difference(
  oldDiffValue: DiffValue,
  newDiffValue: DiffValue,
  options?: DifferenceOptions
) {
  const strict = Boolean(options?.strict);
  const diff: Diff = {
    update: [],
    delete: [],
  };
  const move = new Set<number>();
  const updateOldItems: DiffItem[] = [];

  const oldItems = oldDiffValue.items;
  const newItems = newDiffValue.items;

  oldItems.forEach((oldItem, from) => {
    const to = newItems.findIndex(
      (newItem, to) =>
        oldItem.type === newItem.type &&
        oldItem.key === newItem.key &&
        !move.has(to)
    );

    if (to === -1) {
      if (strict) {
        diff.delete.push({ from });
      } else {
        updateOldItems.push(oldItem);
      }
    } else {
      move.add(to);
      diff.update.push({ action: Action.move, from, to });
    }
  });

  updateOldItems.forEach(oldItem => {
    const from = oldDiffValue.itemToIndex.get(oldItem) as number;
    const toItem = newItems.find(
      (newItem, to) => oldItem.type === newItem.type && !move.has(to)
    );

    if (toItem) {
      const to = newDiffValue.itemToIndex.get(toItem) as number;
      move.add(to);
      diff.update.push({ action: Action.move, from, to });
    } else {
      diff.delete.push({ from });
    }
  });

  newItems.forEach((newItem, to) => {
    if (move.has(to)) return;

    diff.update.push({
      action: Action.create,
      from: -1,
      to: newDiffValue.itemToIndex.get(newItem) as number,
    });
  });

  diff.update.sort((a, b) => a.to - b.to);

  return diff;
}
